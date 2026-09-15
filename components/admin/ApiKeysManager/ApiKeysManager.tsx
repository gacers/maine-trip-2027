"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { PublicTrip, ApiKey } from "@/lib/types";
import styles from "./ApiKeysManager.module.css";

export interface ApiKeysManagerProps {
  trip: PublicTrip;
}

export default function ApiKeysManager({ trip }: ApiKeysManagerProps) {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [label, setLabel] = useState("");
  const [global, setGlobal] = useState(false);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const apiBase = `/api/trips/${trip.slug}/api-keys`;

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(apiBase, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setKeys(data.apiKeys.filter((k: ApiKey) => k.role !== "contributor"));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBase]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const res = await fetch(apiBase, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: label || undefined, role: "owner", global }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setNewToken(data.token);
      setLabel("");
      setGlobal(false);
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleRevoke(id: string) {
    try {
      const res = await fetch(`${apiBase}/${id}`, { method: "PATCH" });
      if (!res.ok) throw new Error("Revoke failed");
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleReveal(id: string) {
    setError("");
    try {
      const res = await fetch(`${apiBase}/${id}/reveal`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRevealed((prev) => ({ ...prev, [id]: data.token }));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className={styles["root"]}>
      <p className={styles["intro"]}>
        Full-access keys — for Claude Desktop or other automation. Can add, edit, delete, and archive. To share a
        limited add-only link with a friend, use Invite Links instead.
      </p>

      {error && <p className={styles["error"]}>{error}</p>}

      {newToken && (
        <div className={styles["new-token-box"]}>
          <p className={styles["new-token-note"]}>
            Save this now, or come back and click &quot;Show&quot; on it later — it&apos;s never emailed or texted
            to you.
          </p>
          <code className={styles["token-code"]}>{newToken}</code>
          <button onClick={() => setNewToken(null)} className={styles["dismiss-button"]}>
            Dismiss
          </button>
        </div>
      )}

      <form onSubmit={handleCreate} className={styles["create-form"]}>
        <div className={styles["create-row"]}>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Label (e.g. Claude Desktop)"
            className={styles["label-input"]}
          />
          <button type="submit" className={styles["generate-button"]}>
            Generate key
          </button>
        </div>
        <label className={styles["global-checkbox-label"]}>
          <input type="checkbox" checked={global} onChange={(e) => setGlobal(e.target.checked)} />
          Valid for all trips, not just this one — generate this once and reuse it everywhere instead of making a
          new key per trip.
        </label>
      </form>

      {loading ? (
        <p className={styles["muted-text"]}>Loading...</p>
      ) : keys.length === 0 ? (
        <p className={styles["muted-text"]}>No keys yet.</p>
      ) : (
        <div className={styles["key-list"]}>
          {keys.map((k) => (
            <div key={k.id} className={k.revoked ? styles["key-card-revoked"] : styles["key-card"]}>
              <div className={styles["key-card-top"]}>
                <div>
                  <div className={styles["key-label"]}>
                    {k.label}
                    {!k.trip_id && <span className={styles["key-label-suffix"]}>(all trips)</span>}
                  </div>
                  <div className={styles["key-meta"]}>
                    Created {new Date(k.created_at).toLocaleDateString()}
                    {k.last_used_at && ` · last used ${new Date(k.last_used_at).toLocaleDateString()}`}
                    {k.revoked && " · revoked"}
                  </div>
                </div>
                {!k.revoked && (
                  <div className={styles["key-actions"]}>
                    {k.hasStoredToken && !revealed[k.id] && (
                      <button onClick={() => handleReveal(k.id)} className={styles["show-button"]}>
                        Show
                      </button>
                    )}
                    <button onClick={() => handleRevoke(k.id)} className={styles["revoke-button"]}>
                      Revoke
                    </button>
                  </div>
                )}
              </div>
              {revealed[k.id] && <code className={styles["token-code"]}>{revealed[k.id]}</code>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
