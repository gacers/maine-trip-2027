"use client";

import { useEffect, useState } from "react";
import classNames from "classnames";
import styles from "./GoogleConnectionsPanel.module.css";

interface CredentialStatus {
  key: "sheets" | "drive" | "maps";
  label: string;
  ok: boolean;
  message: string;
  checkedAt: string;
}

// Where to send someone to actually fix each credential by hand — the
// exact page differs by Google Cloud project, so these land on the
// general list (service accounts / credentials) rather than a
// project-specific deep link this app has no reliable way to build.
const CONSOLE_LINKS: Record<CredentialStatus["key"], { label: string; href: string }> = {
  sheets: { label: "Open Service Accounts in Google Cloud Console", href: "https://console.cloud.google.com/iam-admin/serviceaccounts" },
  drive: { label: "Open OAuth consent screen in Google Cloud Console", href: "https://console.cloud.google.com/apis/credentials/consent" },
  maps: { label: "Open API Credentials in Google Cloud Console", href: "https://console.cloud.google.com/apis/credentials" },
};

function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

// Live status for the three, differently-authenticated Google
// integrations this site depends on (see lib/googleCredentialHealth.ts)
// — a Sheets/Docs service account, a Drive OAuth grant, and a plain
// Maps/Places API key. Each fails independently and gets fixed a
// different way, so this shows all three separately rather than one
// combined "Google is broken" indicator.
export default function GoogleConnectionsPanel() {
  const [statuses, setStatuses] = useState<CredentialStatus[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/google/health");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to check Google connections");
      setStatuses(data.statuses);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  return (
    <div className={styles["root"]}>
      <div className={styles["header"]}>
        <h2 className={styles["title"]}>Google connections</h2>
        <button type="button" onClick={refresh} disabled={loading} className={styles["refresh-button"]}>
          {loading ? "Checking..." : "Refresh"}
        </button>
      </div>
      <p className={styles["hint"]}>
        Sheets/Docs export, Drive file creation, and Maps/Places each use their own separate Google
        credential — if one gets revoked or disabled, only that piece breaks. Checked live, not cached.
      </p>

      {error && <p className={styles["error"]}>{error}</p>}

      {statuses && (
        <div className={styles["card-list"]}>
          {statuses.map((s) => (
            <div key={s.key} className={styles["card"]}>
              <div className={styles["card-header"]}>
                <span className={classNames(styles["pill"], s.ok ? styles["pill-ok"] : styles["pill-broken"])}>
                  {s.ok ? "Working" : "Broken"}
                </span>
                <span className={styles["card-label"]}>{s.label}</span>
              </div>
              <p className={styles["card-message"]}>{s.message}</p>
              <div className={styles["card-footer"]}>
                <span className={styles["card-time"]}>Checked {timeAgo(s.checkedAt)}</span>
                {!s.ok && (
                  <a href={CONSOLE_LINKS[s.key].href} target="_blank" rel="noopener noreferrer" className={styles["fix-link"]}>
                    {CONSOLE_LINKS[s.key].label} →
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
