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
  // Mirrors trip.google_sheet_url, updated locally once a fresh export
  // creates it — the server-fetched `trip` prop otherwise wouldn't
  // reflect that until the next page load.
  const [sheetUrl, setSheetUrl] = useState(trip.google_sheet_url ?? null);
  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState("");
  const [collabEmail, setCollabEmail] = useState("");
  const [collabRole, setCollabRole] = useState<"writer" | "reader">("writer");
  const [invitingCollab, setInvitingCollab] = useState(false);
  const [collabMsg, setCollabMsg] = useState("");
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
    <div className={styles.wrapper}>
      <p className={styles.intro}>
        Share a link with a friend so they can add houses/food/activities and leave notes or concerns without
        signing in. They can&apos;t edit or delete anything you&apos;ve already added.
      </p>

      <div className={styles.sheetAccessBox}>
        <p className={styles.sheetAccessText}>
          <span className={styles.sheetAccessLabel}>Google Sheet:</span>{" "}
          {sheetUrl ? (
            <>
              <a href={sheetUrl} target="_blank" rel="noopener noreferrer">
                open it
              </a>{" "}
              — every link inside already carries its own standing invite, so anyone you share it with can click
              through and add things, no separate invite link needed.
            </>
          ) : (
            <>
              not created yet — it&apos;s created automatically the first time anyone adds an item to any section.
              You don&apos;t have to wait for that.
            </>
          )}
        </p>
        <div className={styles.rotateRow}>
          <button onClick={handleExportSheet} disabled={exporting} className={styles.actionButton}>
            {exporting ? (sheetUrl ? "Re-exporting..." : "Creating...") : sheetUrl ? "Re-export all sections now" : "Create the Sheet now"}
          </button>
          {sheetUrl && (
            <button onClick={handleRotateSheetInvite} disabled={rotating} className={styles.rotateButton}>
              {rotating ? "Rotating..." : "Rotate (invalidate the Sheet's current links)"}
            </button>
          )}
        </div>
        {exportMsg && <p className={styles.rotateMsg}>{exportMsg}</p>}
        {rotateMsg && <p className={styles.rotateMsg}>{rotateMsg}</p>}

        {sheetUrl && (
          <form onSubmit={handleInviteCollaborator} className={styles.collabForm}>
            <p className={styles.sheetAccessText}>
              <span className={styles.sheetAccessLabel}>Add someone to the Sheet:</span> gives them real Google
              access (not just the link) — Google emails them directly.
            </p>
            <div className={styles.collabRow}>
              <input
                type="email"
                required
                placeholder="their@email.com"
                value={collabEmail}
                onChange={(e) => setCollabEmail(e.target.value)}
                className={styles.collabInput}
              />
              <select
                value={collabRole}
                onChange={(e) => setCollabRole(e.target.value as "writer" | "reader")}
                className={styles.collabSelect}
              >
                <option value="writer">Can edit</option>
                <option value="reader">Can view</option>
              </select>
              <button type="submit" disabled={invitingCollab || !collabEmail.trim()} className={styles.actionButton}>
                {invitingCollab ? "Adding..." : "Add"}
              </button>
            </div>
            {collabMsg && <p className={styles.rotateMsg}>{collabMsg}</p>}
          </form>
        )}
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
