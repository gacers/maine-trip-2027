"use client";

import { useEffect, useState, type FormEvent } from "react";
import SheetAccessBox from "./SheetAccessBox";
import InviteKeyList from "./InviteKeyList";
import type { Trip, ApiKey } from "@/lib/types";
import styles from "./InviteLinksManager.module.css";

export interface InviteLinksManagerProps {
  trip: Trip;
}

type InviteMode = "email" | "link";

// Same shape as ApiKeysManager, but for `role: "contributor"` keys —
// each one backs one shareable invite link
// (`/{tripSlug}?invite=<token>`). Visiting that link lets a friend
// add/edit from the site without signing in. Two ways to hand it out:
// "Invite via email" (Resend, one person, ?email= prefill) or "Shareable
// link" (plain multi-use URL, same idea as the Google Sheet pipeline's
// standing invite — WhatsApp, Slack, etc.).
export default function InviteLinksManager({ trip }: InviteLinksManagerProps) {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [label, setLabel] = useState("");
  const [mode, setMode] = useState<InviteMode>("email");
  const [creating, setCreating] = useState(false);
  const [sending, setSending] = useState(false);
  const [newInvite, setNewInvite] = useState<{
    link: string;
    token: string;
    email: string | null;
    emailed: boolean;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const apiBase = `/api/trips/${trip.slug}/api-keys`;
  const inviteEmailApi = `/api/trips/${trip.slug}/invite-email`;

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

  async function sendInviteEmail(to: string, token: string): Promise<string> {
    const res = await fetch(inviteEmailApi, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: to, token }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to send invite email");
    return typeof data.inviteUrl === "string"
      ? data.inviteUrl
      : `${window.location.origin}${buildInviteLink(token, to)}`;
  }

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(apiBase, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      // Revoked links used to stick around here forever, greyed out
      // with a "· revoked" label — a revoked link is dead, not a state
      // worth reviewing later, so drop it from the list entirely
      // rather than showing a disabled row (the row itself is still in
      // api_keys, just never rendered).
      setKeys(data.apiKeys.filter((k: ApiKey) => k.role === "contributor" && !k.revoked));
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

    if (mode === "email") {
      const trimmed = email.trim();
      if (!looksLikeEmail(trimmed)) {
        setError("A valid email is required");
        return;
      }
      setCreating(true);
      try {
        const res = await fetch(apiBase, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ label: trimmed, role: "contributor" }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        const link = await sendInviteEmail(trimmed, data.token);
        setNewInvite({ link, token: data.token, email: trimmed, emailed: true });
        setEmail("");
        setCopied(false);
        load();
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setCreating(false);
      }
      return;
    }

    // Shareable link — same multi-use contributor token as the Sheet
    // pipeline (ensureSheetInviteToken). Optional label only; no ?email=.
    const inviteLabel = label.trim() || `Shared link — ${trip.name}`;
    setCreating(true);
    try {
      const res = await fetch(apiBase, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: inviteLabel, role: "contributor" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const link = `${window.location.origin}${buildInviteLink(data.token)}`;
      setNewInvite({ link, token: data.token, email: null, emailed: false });
      setLabel("");
      setCopied(false);
      load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCreating(false);
    }
  }

  async function handleResend() {
    if (!newInvite?.email) return;
    setError("");
    setSending(true);
    try {
      const link = await sendInviteEmail(newInvite.email, newInvite.token);
      setNewInvite({ ...newInvite, link, emailed: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
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
        Invite people to the site — they land with access and can create a permanent login.{" "}
        <strong>Invite via email</strong> sends one person a link (create-login prefilled).{" "}
        <strong>Shareable link</strong> is a plain multi-use URL (WhatsApp, Slack, etc.) — same idea as the
        Google Sheet pipeline&apos;s standing invite. Prefer sharing the spreadsheet? Use the Google Sheet box
        below; every Sheet link already carries its own invite.
      </p>

      {error && <p className={styles["error"]}>{error}</p>}

      <form onSubmit={handleCreate} className={styles["create-form"]}>
        {mode === "email" ? (
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="their@email.com"
            className={styles["label-input"]}
            aria-label="Invitee email"
          />
        ) : (
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Label (optional) — e.g. WhatsApp group"
            className={styles["label-input"]}
            aria-label="Invite label"
          />
        )}
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as InviteMode)}
          className={styles["mode-select"]}
          aria-label="Invite method"
        >
          <option value="email">Invite via email</option>
          <option value="link">Shareable link</option>
        </select>
        <button type="submit" className={styles["create-button"]} disabled={creating || sending}>
          {creating
            ? mode === "email"
              ? "Sending..."
              : "Creating..."
            : mode === "email"
              ? "Invite"
              : "Create link"}
        </button>
      </form>

      {newInvite && (
        <div className={styles["new-invite-box"]}>
          <p className={styles["new-invite-note"]}>
            {newInvite.emailed && newInvite.email
              ? `Invite emailed to ${newInvite.email}. You can still copy the link or resend.`
              : "Anyone with this link gets access in their browser — same as Sheet invites. Copy it wherever you like; they can create a login once they're in."}
          </p>
          <div className={styles["new-invite-row"]}>
            <code className={styles["link-code"]}>{newInvite.link}</code>
            <button type="button" onClick={copyLink} className={styles["copy-button"]}>
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <div className={styles["new-invite-actions"]}>
            {newInvite.email && (
              <button
                type="button"
                onClick={handleResend}
                className={styles["resend-button"]}
                disabled={sending}
              >
                {sending ? "Sending..." : newInvite.emailed ? "Resend email" : "Send email"}
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
