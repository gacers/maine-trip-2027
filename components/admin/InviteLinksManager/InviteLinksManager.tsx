"use client";

import { useEffect, useState, type FormEvent } from "react";
import SheetAccessBox from "./components/SheetAccessBox";
import InviteKeyList from "./components/InviteKeyList";
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

  return (
    <div className={styles["wrapper"]}>
      <p className={styles["intro"]}>
        Share a link with a friend so they can add houses/food/activities and leave notes or concerns without
        signing in. They can&apos;t edit or delete anything you&apos;ve already added.
      </p>

      <SheetAccessBox trip={trip} />

      {error && <p className={styles["error"]}>{error}</p>}

      {newInvite && (
        <div className={styles["new-invite-box"]}>
          <p className={styles["new-invite-note"]}>Save this now, or come back and click &quot;Show&quot; on it later.</p>
          <div className={styles["new-invite-row"]}>
            <code className={styles["link-code"]}>{newInvite.link}</code>
            <button onClick={copyLink} className={styles["copy-button"]}>
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <button onClick={() => setNewInvite(null)} className={styles["dismiss-button"]}>
            Dismiss
          </button>
        </div>
      )}

      <form onSubmit={handleCreate} className={styles["create-form"]}>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Label (e.g. Alex & Sam)"
          className={styles["label-input"]}
        />
        <button type="submit" className={styles["create-button"]}>
          Create invite link
        </button>
      </form>

      <InviteKeyList loading={loading} keys={keys} revealed={revealed} onReveal={handleReveal} onRevoke={handleRevoke} />
    </div>
  );
}
