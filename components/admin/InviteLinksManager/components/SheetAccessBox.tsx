import { useState, type FormEvent } from "react";
import type { Trip } from "@/lib/types";
import styles from "./SheetAccessBox.module.css";

export interface SheetAccessBoxProps {
  trip: Trip;
}

// Everything about this trip's Google Sheet — its link (once it
// exists), creating/re-exporting it on demand, inviting a real
// Google-account collaborator, and rotating its embedded invite links.
// Fully self-contained: owns every piece of state these five actions
// need, and shows its own errors/status inline rather than sharing the
// parent's invite-key-list error banner.
export default function SheetAccessBox({ trip }: SheetAccessBoxProps) {
  // Mirrors trip.google_sheet_url, updated locally once a fresh export
  // creates it — the server-fetched `trip` prop otherwise wouldn't
  // reflect that until the next page load.
  const [sheetUrl, setSheetUrl] = useState(trip.google_sheet_url ?? null);
  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState("");
  const [rotating, setRotating] = useState(false);
  const [rotateMsg, setRotateMsg] = useState("");
  const [collabEmail, setCollabEmail] = useState("");
  const [collabRole, setCollabRole] = useState<"writer" | "reader">("writer");
  const [invitingCollab, setInvitingCollab] = useState(false);
  const [collabMsg, setCollabMsg] = useState("");
  const [error, setError] = useState("");

  // The Sheet is otherwise created lazily — the first time any
  // section's entries actually get written to (see
  // lib/sheetsExport.ts's exportSection) — which leaves a brand-new
  // trip with no Sheet, and nothing on the page saying so or offering
  // a way to get one sooner. This triggers a real export of every
  // section right now, whether that's the very first one (creating
  // the spreadsheet from scratch, even with nothing in it yet) or a
  // manual re-sync of a Sheet that already exists.
  async function handleExportSheet() {
    setExporting(true);
    setExportMsg("");
    setError("");
    try {
      const res = await fetch(`/api/trips/${trip.slug}/sheet-export`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Export failed");
      const wasAlreadyLinked = !!sheetUrl;
      setSheetUrl(data.spreadsheetUrl);
      setExportMsg(wasAlreadyLinked ? "Done — every section re-exported." : "Done — the Sheet is ready.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setExporting(false);
    }
  }

  // Grants one specific person real Google Sheets access (edit or
  // view) by email, on top of the "anyone with the link can view"
  // sharing the Sheet already has — Google emails them directly that
  // they now have access, so there's nothing further to hand them.
  async function handleInviteCollaborator(e: FormEvent) {
    e.preventDefault();
    if (!collabEmail.trim()) return;
    setInvitingCollab(true);
    setCollabMsg("");
    setError("");
    try {
      const res = await fetch(`/api/trips/${trip.slug}/sheet-collaborators`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: collabEmail.trim(), role: collabRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't add them");
      setCollabMsg(`Done — Google emailed ${collabEmail.trim()} that they now have access.`);
      setCollabEmail("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setInvitingCollab(false);
    }
  }

  async function handleRotateSheetInvite() {
    setRotating(true);
    setRotateMsg("");
    setError("");
    try {
      const res = await fetch(`/api/trips/${trip.slug}/sheet-invite/rotate`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Rotate failed");
      setRotateMsg("Done — old links in the Sheet no longer work; every tab now links out with a fresh one.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRotating(false);
    }
  }

  return (
    <div className={styles["root"]}>
      <p className={styles["text"]}>
        <span className={styles["label"]}>Google Sheet:</span>{" "}
        {sheetUrl ? (
          <>
            <a href={sheetUrl} target="_blank" rel="noopener noreferrer">
              open it
            </a>{" "}
            — every link inside already carries its own standing invite, so anyone you share it with can click
            through and add things, no separate invite link needed.
          </>
        ) : (
          <>not created yet — it&apos;s created automatically the first time anyone adds an item to any section. You don&apos;t have to wait for that.</>
        )}
      </p>
      <div className={styles["actions-row"]}>
        <button onClick={handleExportSheet} disabled={exporting} className={styles["action-button"]}>
          {exporting ? (sheetUrl ? "Re-exporting..." : "Creating...") : sheetUrl ? "Re-export all sections now" : "Create the Sheet now"}
        </button>
        {sheetUrl && (
          <button onClick={handleRotateSheetInvite} disabled={rotating} className={styles["rotate-button"]}>
            {rotating ? "Rotating..." : "Rotate (invalidate the Sheet's current links)"}
          </button>
        )}
      </div>
      {exportMsg && <p className={styles["status-msg"]}>{exportMsg}</p>}
      {rotateMsg && <p className={styles["status-msg"]}>{rotateMsg}</p>}
      {error && <p className={styles["error"]}>{error}</p>}

      {sheetUrl && (
        <form onSubmit={handleInviteCollaborator} className={styles["collab-form"]}>
          <p className={styles["text"]}>
            <span className={styles["label"]}>Add someone to the Sheet:</span> gives them real Google access (not
            just the link) — Google emails them directly.
          </p>
          <div className={styles["collab-row"]}>
            <input
              type="email"
              required
              placeholder="their@email.com"
              value={collabEmail}
              onChange={(e) => setCollabEmail(e.target.value)}
              className={styles["collab-input"]}
            />
            <select value={collabRole} onChange={(e) => setCollabRole(e.target.value as "writer" | "reader")} className={styles["collab-select"]}>
              <option value="writer">Can edit</option>
              <option value="reader">Can view</option>
            </select>
            <button type="submit" disabled={invitingCollab || !collabEmail.trim()} className={styles["action-button"]}>
              {invitingCollab ? "Adding..." : "Add"}
            </button>
          </div>
          {collabMsg && <p className={styles["status-msg"]}>{collabMsg}</p>}
        </form>
      )}
    </div>
  );
}
