"use client";

import { useEffect, useState } from "react";
import Button from "@/components/Button";
import styles from "./DocExportBox.module.css";

export interface DocExportBoxProps {
  tripSlug: string;
  authToken: string | null;
}

// The itinerary's own "Export to Google Doc" — same lazily-created-
// on-first-export shape as the trip's Sheet (see SheetAccessBox), just
// simpler: no per-person collaborator invite, that's not needed for a
// first version of this. Explicit-only, no auto-export on every stop
// edit (see lib/itineraryDocExport.ts) — this is an occasional
// "get me something to share" action, not a live sync.
export default function DocExportBox({ tripSlug, authToken }: DocExportBoxProps) {
  const [docUrl, setDocUrl] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const authHeaders: Record<string, string> = authToken ? { Authorization: `Bearer ${authToken}` } : {};

  useEffect(() => {
    fetch(`/api/trips/${tripSlug}/itinerary/doc-url`, { headers: authHeaders })
      .then((res) => res.json())
      .then((data) => setDocUrl(data.googleItineraryDocUrl || null))
      .catch(() => {})
      .finally(() => setLoaded(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripSlug]);

  async function handleExport() {
    setExporting(true);
    setMessage("");
    setError("");
    try {
      const res = await fetch(`/api/trips/${tripSlug}/itinerary/export`, {
        method: "POST",
        headers: authHeaders,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Export failed");
      const wasAlreadyLinked = !!docUrl;
      setDocUrl(data.docUrl);
      setMessage(wasAlreadyLinked ? "Done — re-exported." : "Done — the Doc is ready.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setExporting(false);
    }
  }

  if (!loaded) return null;

  return (
    <div className={styles["root"]}>
      <div className={styles["row"]}>
        <Button variant="secondary" size="sm" disabled={exporting} onClick={handleExport}>
          {exporting ? (docUrl ? "Re-exporting..." : "Creating...") : docUrl ? "Re-export to Google Doc" : "Export to Google Doc"}
        </Button>
        {docUrl && (
          <a href={docUrl} target="_blank" rel="noopener noreferrer" className={styles["link"]}>
            Open it
          </a>
        )}
      </div>
      {message && <p className={styles["message"]}>{message}</p>}
      {error && <p className={styles["error"]}>{error}</p>}
    </div>
  );
}
