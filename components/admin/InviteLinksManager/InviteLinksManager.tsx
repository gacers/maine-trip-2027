"use client";

import { useEffect, useState, type FormEvent } from "react";
import SheetAccessBox from "./components/SheetAccessBox";
import InviteKeyList from "./components/InviteKeyList";
import type { Trip, ApiKey } from "@/lib/types";
import styles from "./InviteLinksManager.module.css";

export interface InviteLinksManagerProps {
  trip: Trip;
}

type InviteMode = "email" | "link";

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
  const [email, setEmail] = useState("");
  const [mode, setMode] = useState<InviteMode>("email");
  const [creating, setCreating] = useState(false);
  const [newInvite, setNewInvite] = useState<{ link: string; token: string; emailed: boolean } | null>(null);
  const [copied, setCopied] = useState(false);
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const apiBase = `/api/trips/${trip.slug}/api-keys`;

  function buildInviteLink(token: string, emailForLink?: string): string {
    const url = new URL(`/${trip.slug}`, window.location.origin);
    url.searchParams.set("invite", token);
    const trimmed = emailForLink?.trim();
    if (trimmed) url.searchParams.set("email", trimmed);
    return url.pathname + url.search;
  }

  function looksLikeEmail(value: string | null | undefined): boolean {
    return !!value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
  }

  function openInviteMailto(to: string, link: string) {
    const subject = `Invite to ${trip.name}`;
    const body = [
      `You're invited to help plan ${trip.name}.`,
      "",
      "Open this link to get access (works in this browser; you can create a permanent login once you're in):",
      link,
      "",
    ].join("\n");
    window.location.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

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
    const trimmed = email.trim();
    if (!trimmed) {
      setError("Email is required");
      return;
    }
    setCreating(true);
    try {
      // Email is the invite's label too — shows in the list, and Reveal
      // can re-attach ?email= when the stored label still looks like one.
      const res = await fetch(apiBase, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: trimmed, role: "contributor" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const link = `${window.location.origin}${buildInviteLink(data.token, trimmed)}`;
      const emailed = mode === "email";
      setNewInvite({ link, token: data.token, emailed });
      setEmail("");
      setCopied(false);
      load();
      if (emailed) openInviteMailto(trimmed, link);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCreating(false);
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
      const key = keys.find((k) => k.id === id);
      const emailForLink = looksLikeEmail(key?.label) ? key!.label!.trim() : undefined;
      const link = `${window.location.origin}${buildInviteLink(data.token, emailForLink)}`;
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
        Invite someone straight to the site — they land with access and the create-login form prefilled. Prefer
        sharing the spreadsheet? Use the Google Sheet box below (or Google&apos;s own share); every Sheet link already
        carries its own invite. Invitees can add, edit, and archive, but can&apos;t permanently delete or change trip
        settings.
      </p>

      {error && <p className={styles["error"]}>{error}</p>}

      <form onSubmit={handleCreate} className={styles["create-form"]}>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="their@email.com"
          className={styles["label-input"]}
        />
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as InviteMode)}
          className={styles["mode-select"]}
          aria-label="Invite method"
        >
          <option value="email">Invite via email</option>
          <option value="link">Generate link</option>
        </select>
        <button type="submit" className={styles["create-button"]} disabled={creating}>
          {creating ? "Creating..." : mode === "email" ? "Invite" : "Create link"}
        </button>
      </form>

      {newInvite && (
        <div className={styles["new-invite-box"]}>
          <p className={styles["new-invite-note"]}>
            {newInvite.emailed
              ? "Invite created — your email app should open with the link ready to send. You can still copy it here."
              : "Save this now, or come back and click \"Show\" on it later."}
          </p>
          <div className={styles["new-invite-row"]}>
            <code className={styles["link-code"]}>{newInvite.link}</code>
            <button type="button" onClick={copyLink} className={styles["copy-button"]}>
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <div className={styles["new-invite-actions"]}>
            {newInvite.emailed && (
              <button
                type="button"
                onClick={() => {
                  const emailParam = new URL(newInvite.link).searchParams.get("email");
                  if (emailParam) openInviteMailto(emailParam, newInvite.link);
                }}
                className={styles["resend-button"]}
              >
                Open email again
              </button>
            )}
            <button type="button" onClick={() => setNewInvite(null)} className={styles["dismiss-button"]}>
              Dismiss
            </button>
          </div>
        </div>
      )}

      <SheetAccessBox trip={trip} />

      <InviteKeyList loading={loading} keys={keys} revealed={revealed} onReveal={handleReveal} onRevoke={handleRevoke} />
    </div>
  );
}
