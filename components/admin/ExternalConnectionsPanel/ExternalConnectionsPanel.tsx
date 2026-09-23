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
  /** Exactly where to get a replacement value and which part of it to
   * copy — the thing this panel got asked for directly, after a first
   * pass at generating one went wrong. */
  steps: string[];
  /** Only the two service-account private keys are real multi-line PEM
   * blocks — pasting one into a single-line <input> silently mangled
   * it (confirmed live: that's what actually broke Sheets, not the key
   * itself), so this flags the one case that needs its own newline
   * handling before the value gets pushed. */
  pem?: boolean;
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
// are commonly two genuinely different key values.
const PUSH_FIELDS: Record<CredentialStatus["key"], PushField[]> = {
  sheets: [
    {
      envKey: "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",
      label: "New private key",
      placeholder: "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----",
      pem: true,
      steps: [
        "Google Cloud Console → IAM & Admin → Service Accounts",
        "Click the maine-2027 service account (same email this card is checking)",
        "Keys tab → Add Key → Create new key → JSON → Create — this downloads a .json file",
        "Open that file and copy the entire private_key value, including the BEGIN/END lines",
        "Paste it below exactly as it appears in the file — real line breaks are fine, this field handles them",
      ],
    },
  ],
  drive: [
    {
      envKey: "GOOGLE_OAUTH_REFRESH_TOKEN",
      label: "New refresh token",
      placeholder: "Paste the new refresh_token",
      steps: [
        "This one's different from the other two — it's not a key you can just generate on a Google Cloud page",
        "It needs this app's OAuth client (GOOGLE_OAUTH_CLIENT_ID/_SECRET, unchanged) to re-run its consent flow for the Google account that owns the Drive files, which produces a fresh refresh_token",
        "There's no self-serve console page for that step yet — ask for the \"Reconnect Google Drive\" button to be built if this one ever actually breaks, rather than trying to hand-generate a token",
      ],
    },
  ],
  maps: [
    {
      envKey: "GOOGLE_MAPS_SERVER_API_KEY",
      label: "New server key",
      placeholder: "AIza...",
      steps: [
        "Google Cloud Console → APIs & Services → Credentials",
        "Find the existing server-side key (no HTTP referrer restriction), or Create Credentials → API key for a new one",
        "Click the key's name to open its details, then \"Show key\" and copy the value",
      ],
    },
    {
      envKey: "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY",
      label: "New public key",
      placeholder: "AIza...",
      steps: [
        "Same Credentials page — this is the *other* key, the one with an HTTP referrer restriction (it's exposed in the browser, so it's locked to this site's own domain instead of being kept secret)",
        "Click that key's name, \"Show key\", copy the value",
      ],
    },
  ],
  airbnb: [
    {
      envKey: "AIRBNB_SESSION_COOKIE",
      label: "New session cookie",
      placeholder: "Paste the full 'cookie' request header value from DevTools",
      steps: [
        "Log into airbnb.com in your own browser (a real account, not incognito)",
        "Open DevTools → Network tab, then reload the page",
        "Click any request to airbnb.com in the list, open its Request Headers",
        "Copy the entire \"cookie\" header value (it's long — get all of it)",
      ],
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

// A pasted PEM block sometimes comes as real line breaks (copied
// straight out of the downloaded JSON file's own pretty-printed
// display) and sometimes as one line with literal \n escapes (copied
// out of the raw JSON text) — either is fine; this always normalizes
// to the single-line \n-escaped form the app already expects to find
// in the env var and un-escape at read time (see
// lib/googleSheetsAuth.ts). Blank lines from paste artifacts are
// dropped; PEM bodies never have meaningful ones.
function normalizePemValue(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed.includes("\n")) return trimmed;
  return trimmed
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\\n");
}

interface PushFieldRowProps {
  field: PushField;
}

// One "paste a new value, push it" control — generating the actual
// replacement always happens by hand (Google Cloud Console, a
// logged-in Airbnb browser session, or — for Drive — a separate
// re-authorization step) first; this is just the part that used to
// mean hand-navigating Vercel's own dashboard to find the right env
// var and click redeploy.
function PushFieldRow({ field }: PushFieldRowProps) {
  const [value, setValue] = useState("");
  const [pushing, setPushing] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function push() {
    if (!value.trim()) return;
    const toSend = field.pem ? normalizePemValue(value) : value.trim();
    setPushing(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/credentials/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: field.envKey, value: toSend }),
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
      <ol className={styles["steps-list"]}>
        {field.steps.map((step, i) => (
          <li key={i}>{step}</li>
        ))}
      </ol>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={field.placeholder}
        rows={field.pem ? 4 : 2}
        className={styles["push-textarea"]}
      />
      <button type="button" onClick={push} disabled={pushing || !value.trim()} className={styles["push-button"]}>
        {pushing ? "Pushing..." : "Push & redeploy"}
      </button>
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
