"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { Trip, ApiKey } from "@/lib/types";
import styles from "./InviteLinksManager.module.css";

export interface InviteLinksManagerProps {
  trip: Trip;
}

// Same shape as ApiKeysManager, but for `role: "contributor"` keys —
// each one backs one shareable invite link
// (`{site}/{tripSlug}?invite=<token>`). Visiting that link lets a friend
// add new entries and append notes/concerns from the site itself (see
// SectionPage's invite-capture effect) without ever signing in, and
// without you generating and handing them a raw API key.
export default function InviteLinksManager({ trip }: InviteLinksManagerProps) {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [label, setLabel] = useState("");
  const [newInvite, setNewInvite] = useState<{ link: string; token: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [rotateMsg, setRotateMsg] = useState("");
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const apiBase = `/api/trips/${trip.slug}/api-keys`;

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(apiBase, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setKeys(data.apiKeys.filter((k: ApiKey) => k.role === "contributor"));
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
        body: JSON.stringify({ label: label || undefined, role: "contributor" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const link = `${window.location.origin}/${trip.slug}?invite=${data.token}`;
      setNewInvite({ link, token: data.token });
      setLabel("");
      setCopied(false);
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
      const link = `${window.location.origin}/${trip.slug}?invite=${data.token}`;
      setRevealed((prev) => ({ ...prev, [id]: link }));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function copyLink() {
    if (!newInvite) return;
    try {
      await navigator.clipboard.writeText(newInvite.link);
      setCopied(true);
    } catch {
      // clipboard API can be unavailable (older browser, non-https) —
      // the link is still selectable/visible in the box below.
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
    <div className={styles.wrapper}>
      <p className={styles.intro}>
        Share a link with a friend so they can add houses/food/activities and leave notes or concerns without
        signing in. They can&apos;t edit or delete anything you&apos;ve already added.
      </p>

      <div className={styles.sheetAccessBox}>
        <p className={styles.sheetAccessText}>
          <span className={styles.sheetAccessLabel}>Google Sheet access:</span>{" "}
          {trip.sheet_invite_token ? (
            <>
              every link inside the Sheet already carries its own standing invite — anyone you share the Sheet with
              can click through and add things, no separate invite link needed.
            </>
          ) : (
            <>set up automatically the first time this trip&apos;s Sheet exports.</>
          )}
        </p>
        {trip.sheet_invite_token && (
          <div className={styles.rotateRow}>
            <button onClick={handleRotateSheetInvite} disabled={rotating} className={styles.rotateButton}>
              {rotating ? "Rotating..." : "Rotate (invalidate the Sheet's current links)"}
            </button>
          </div>
        )}
        {rotateMsg && <p className={styles.rotateMsg}>{rotateMsg}</p>}
      </div>

      {error && <p className={styles.error}>{error}</p>}

      {newInvite && (
        <div className={styles.newInviteBox}>
          <p className={styles.newInviteNote}>Save this now, or come back and click &quot;Show&quot; on it later.</p>
          <div className={styles.newInviteRow}>
            <code className={styles.linkCode}>{newInvite.link}</code>
            <button onClick={copyLink} className={styles.copyButton}>
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <button onClick={() => setNewInvite(null)} className={styles.dismissButton}>
            Dismiss
          </button>
        </div>
      )}

      <form onSubmit={handleCreate} className={styles.createForm}>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Label (e.g. Alex & Sam)"
          className={styles.labelInput}
        />
        <button type="submit" className={styles.createButton}>
          Create invite link
        </button>
      </form>

      {loading ? (
        <p className={styles.mutedText}>Loading...</p>
      ) : keys.length === 0 ? (
        <p className={styles.mutedText}>No invite links yet.</p>
      ) : (
        <div className={styles.keyList}>
          {keys.map((k) => (
            <div key={k.id} className={k.revoked ? styles.keyCardRevoked : styles.keyCard}>
              <div className={styles.keyCardTop}>
                <div>
                  <div className={styles.keyLabel}>{k.label}</div>
                  <div className={styles.keyMeta}>
                    Created {new Date(k.created_at).toLocaleDateString()}
                    {k.last_used_at && ` · last used ${new Date(k.last_used_at).toLocaleDateString()}`}
                    {k.revoked && " · revoked"}
                  </div>
                </div>
                {!k.revoked && (
                  <div className={styles.keyActions}>
                    {k.hasStoredToken && !revealed[k.id] && (
                      <button onClick={() => handleReveal(k.id)} className={styles.showButton}>
                        Show
                      </button>
                    )}
                    <button onClick={() => handleRevoke(k.id)} className={styles.revokeButton}>
                      Revoke
                    </button>
                  </div>
                )}
              </div>
              {revealed[k.id] && <code className={styles.linkCode}>{revealed[k.id]}</code>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
