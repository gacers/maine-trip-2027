"use client";

import { useEffect, useState } from "react";
import classNames from "classnames";
import styles from "./ExternalConnectionsPanel.module.css";

interface CredentialStatus {
  key: "sheets" | "drive" | "maps" | "airbnb";
  label: string;
  ok: boolean;
  message: string;
  checkedAt: string;
}

interface PushField {
  envKey: string;
  label: string;
  placeholder: string;
}

// Where to send someone to actually fix each credential by hand — the
// exact page differs by Google Cloud project, so these land on the
// general list (service accounts / credentials) rather than a
// project-specific deep link this app has no reliable way to build.
// Airbnb has no console page at all — see PUSH_FIELDS' own comment.
const CONSOLE_LINKS: Partial<Record<CredentialStatus["key"], { label: string; href: string }>> = {
  sheets: { label: "Open Service Accounts in Google Cloud Console", href: "https://console.cloud.google.com/iam-admin/serviceaccounts" },
  drive: { label: "Open OAuth consent screen in Google Cloud Console", href: "https://console.cloud.google.com/apis/credentials/consent" },
  maps: { label: "Open API Credentials in Google Cloud Console", href: "https://console.cloud.google.com/apis/credentials" },
};

// Which env var(s) a manually-generated replacement for each credential
// actually gets pushed into — see PUSHABLE_KEYS in
// app/api/admin/credentials/push/route.ts, the server-side allowlist
// this has to stay in sync with. Rotating a service account *key* only
// ever changes its private key, never its email/identity, so sheets
// has just the one field; Maps has two since the server (unrestricted)
// and public (browser-exposed, usually HTTP-referrer-restricted) keys
// are commonly two genuinely different key values. Airbnb has no
// console/API to regenerate anything at all — just log into airbnb.com,
// open DevTools' Network tab, and copy the "cookie" request header off
// any airbnb.com request (see lib/scrape.ts's own header comment).
const PUSH_FIELDS: Record<CredentialStatus["key"], PushField[]> = {
  sheets: [
    {
      envKey: "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",
      label: "New private key",
      placeholder: "Paste the private_key value from the downloaded JSON key file",
    },
  ],
  drive: [
    {
      envKey: "GOOGLE_OAUTH_REFRESH_TOKEN",
      label: "New refresh token",
      placeholder: "Paste the new refresh_token",
    },
  ],
  maps: [
    { envKey: "GOOGLE_MAPS_SERVER_API_KEY", label: "New server key", placeholder: "Paste the new server-side API key" },
    { envKey: "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY", label: "New public key", placeholder: "Paste the new browser-side API key" },
  ],
  airbnb: [
    {
      envKey: "AIRBNB_SESSION_COOKIE",
      label: "New session cookie",
      placeholder: "Paste the full 'cookie' request header value from DevTools",
    },
  ],
};

function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

interface PushFieldRowProps {
  field: PushField;
}

// One "paste a new value, push it" control — generating the actual
// replacement always happens by hand (Google Cloud Console, or a
// logged-in Airbnb browser session) first; this is just the part that
// used to mean hand-navigating Vercel's own dashboard to find the
// right env var and click redeploy.
function PushFieldRow({ field }: PushFieldRowProps) {
  const [value, setValue] = useState("");
  const [pushing, setPushing] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function push() {
    if (!value.trim()) return;
    setPushing(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/credentials/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: field.envKey, value: value.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Push failed");
      setResult({ ok: true, message: "Pushed — redeploying now. Refresh the check above in a minute or two." });
      setValue("");
    } catch (err) {
      setResult({ ok: false, message: (err as Error).message });
    } finally {
      setPushing(false);
    }
  }

  return (
    <div className={styles["push-row"]}>
      <label className={styles["push-label"]}>{field.label}</label>
      <div className={styles["push-input-row"]}>
        <input
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={field.placeholder}
          className={styles["push-input"]}
        />
        <button type="button" onClick={push} disabled={pushing || !value.trim()} className={styles["push-button"]}>
          {pushing ? "Pushing..." : "Push & redeploy"}
        </button>
      </div>
      {result && <p className={result.ok ? styles["push-success"] : styles["error"]}>{result.message}</p>}
    </div>
  );
}

// Live status for every external credential this site depends on that
// can silently expire/get revoked out from under it — the three,
// differently-authenticated Google integrations (see
// lib/googleCredentialHealth.ts: a Sheets/Docs service account, a
// Drive OAuth grant, a plain Maps/Places API key) plus Airbnb's own
// logged-in session cookie (lib/airbnbCookieHealth.ts), which has no
// API/console equivalent at all — just a raw browser cookie captured
// by hand. Each fails independently and gets fixed a different way, so
// this shows them separately rather than one combined "something's
// broken" indicator.
export default function ExternalConnectionsPanel() {
  const [statuses, setStatuses] = useState<CredentialStatus[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<CredentialStatus["key"] | null>(null);

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/credentials/health");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to check external connections");
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
        <h2 className={styles["title"]}>External connections</h2>
        <button type="button" onClick={refresh} disabled={loading} className={styles["refresh-button"]}>
          {loading ? "Checking..." : "Refresh"}
        </button>
      </div>
      <p className={styles["hint"]}>
        Sheets/Docs export, Drive file creation, Maps/Places, and Airbnb scraping each use their own
        separate credential — if one gets revoked or expires, only that piece breaks. Checked live, not cached.
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
                <div className={styles["card-actions"]}>
                  {!s.ok && CONSOLE_LINKS[s.key] && (
                    <a href={CONSOLE_LINKS[s.key]!.href} target="_blank" rel="noopener noreferrer" className={styles["fix-link"]}>
                      {CONSOLE_LINKS[s.key]!.label} →
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => setExpanded((k) => (k === s.key ? null : s.key))}
                    className={styles["fix-link"]}
                  >
                    {expanded === s.key ? "Hide" : "Already generated a new value?"}
                  </button>
                </div>
              </div>
              {expanded === s.key && (
                <div className={styles["push-section"]}>
                  {PUSH_FIELDS[s.key].map((field) => (
                    <PushFieldRow key={field.envKey} field={field} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
