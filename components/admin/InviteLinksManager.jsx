"use client";

import { useEffect, useState } from "react";

// Same shape as ApiKeysManager, but for `role: "contributor"` keys —
// each one backs one shareable invite link
// (`{site}/{tripSlug}?invite=<token>`). Visiting that link lets a friend
// add new entries and append notes/concerns from the site itself (see
// SectionPage's invite-capture effect) without ever signing in, and
// without you generating and handing them a raw API key.
export default function InviteLinksManager({ trip }) {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [label, setLabel] = useState("");
  const [newInvite, setNewInvite] = useState(null); // { link, token }
  const [copied, setCopied] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [rotateMsg, setRotateMsg] = useState("");
  const [revealed, setRevealed] = useState({}); // { [keyId]: link }
  const [builderInviteLink, setBuilderInviteLink] = useState("");
  const [builderListingUrl, setBuilderListingUrl] = useState("");
  const [builtLink, setBuiltLink] = useState("");
  const [builderCopied, setBuilderCopied] = useState(false);
  const apiBase = `/api/trips/${trip.slug}/api-keys`;

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(apiBase, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setKeys(data.apiKeys.filter((k) => k.role === "contributor"));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBase]);

  async function handleCreate(e) {
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
      setError(err.message);
    }
  }

  async function handleRevoke(id) {
    try {
      const res = await fetch(`${apiBase}/${id}`, { method: "PATCH" });
      if (!res.ok) throw new Error("Revoke failed");
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleReveal(id) {
    setError("");
    try {
      const res = await fetch(`${apiBase}/${id}/reveal`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const link = `${window.location.origin}/${trip.slug}?invite=${data.token}`;
      setRevealed((prev) => ({ ...prev, [id]: link }));
    } catch (err) {
      setError(err.message);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(newInvite.link);
      setCopied(true);
    } catch {
      // clipboard API can be unavailable (older browser, non-https) —
      // the link is still selectable/visible in the box below.
    }
  }

  function buildListingLink(e) {
    e.preventDefault();
    setError("");
    setBuilderCopied(false);
    let base;
    try {
      base = new URL(builderInviteLink.trim());
    } catch {
      setError("That doesn't look like a valid invite link.");
      return;
    }
    if (!builderListingUrl.trim()) {
      setError("Paste the listing link to include.");
      return;
    }
    base.searchParams.set("add", builderListingUrl.trim());
    setBuiltLink(base.toString());
  }

  async function copyBuiltLink() {
    try {
      await navigator.clipboard.writeText(builtLink);
      setBuilderCopied(true);
    } catch {
      // clipboard API can be unavailable — the link is still selectable below.
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
      setError(err.message);
    } finally {
      setRotating(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-zinc-500">
        Share a link with a friend so they can add houses/food/activities and leave notes or concerns without
        signing in. They can&apos;t edit or delete anything you&apos;ve already added.
      </p>

      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 flex flex-col gap-2">
        <p className="text-sm text-zinc-700">
          <span className="font-medium">Google Sheet access:</span>{" "}
          {trip.sheet_invite_token ? (
            <>every link inside the Sheet already carries its own standing invite — anyone you share the Sheet
              with can click through and add things, no separate invite link needed.</>
          ) : (
            <>set up automatically the first time this trip&apos;s Sheet exports.</>
          )}
        </p>
        {trip.sheet_invite_token && (
          <div className="flex items-center gap-3">
            <button
              onClick={handleRotateSheetInvite}
              disabled={rotating}
              className="text-sm text-red-600 hover:underline disabled:opacity-50 self-start"
            >
              {rotating ? "Rotating..." : "Rotate (invalidate the Sheet's current links)"}
            </button>
          </div>
        )}
        {rotateMsg && <p className="text-xs text-green-700">{rotateMsg}</p>}
      </div>

      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 flex flex-col gap-2">
        <p className="text-sm font-medium text-zinc-700">Share a specific listing</p>
        <p className="text-xs text-zinc-500">
          Take any invite link above (new or already shared) and a listing link (Airbnb, a restaurant, etc.) —
          the combined link pre-fills and previews that listing the moment it&apos;s opened, so all your friend
          has to do is check it over and hit Save.
        </p>
        <form onSubmit={buildListingLink} className="flex flex-col gap-2">
          <input
            value={builderInviteLink}
            onChange={(e) => setBuilderInviteLink(e.target.value)}
            placeholder="Paste an invite link"
            className="rounded border border-zinc-300 px-3 py-2 text-sm"
          />
          <input
            value={builderListingUrl}
            onChange={(e) => setBuilderListingUrl(e.target.value)}
            placeholder="Paste a listing link (e.g. an Airbnb URL)"
            className="rounded border border-zinc-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded bg-zinc-900 text-white px-4 py-2 text-sm font-medium self-start"
          >
            Build link
          </button>
        </form>
        {builtLink && (
          <div className="flex gap-2">
            <code className="flex-1 text-xs bg-white border border-zinc-200 rounded p-2 break-all select-all">
              {builtLink}
            </code>
            <button
              onClick={copyBuiltLink}
              className="shrink-0 rounded bg-zinc-900 text-white px-3 py-1 text-xs font-medium"
            >
              {builderCopied ? "Copied!" : "Copy"}
            </button>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">{error}</p>}

      {newInvite && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 flex flex-col gap-2">
          <p className="text-sm font-medium text-amber-800">
            Save this now, or come back and click &quot;Show&quot; on it later.
          </p>
          <div className="flex gap-2">
            <code className="flex-1 text-xs bg-white border border-amber-200 rounded p-2 break-all select-all">
              {newInvite.link}
            </code>
            <button
              onClick={copyLink}
              className="shrink-0 rounded bg-zinc-900 text-white px-3 py-1 text-xs font-medium"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <button onClick={() => setNewInvite(null)} className="text-xs text-zinc-500 hover:underline self-start">
            Dismiss
          </button>
        </div>
      )}

      <form onSubmit={handleCreate} className="flex gap-2">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Label (e.g. Alex & Sam)"
          className="flex-1 rounded border border-zinc-300 px-3 py-2 text-sm"
        />
        <button type="submit" className="rounded bg-zinc-900 text-white px-4 py-2 text-sm font-medium">
          Create invite link
        </button>
      </form>

      {loading ? (
        <p className="text-sm text-zinc-500">Loading...</p>
      ) : keys.length === 0 ? (
        <p className="text-sm text-zinc-500">No invite links yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {keys.map((k) => (
            <div
              key={k.id}
              className={`rounded-lg border p-3 flex flex-col gap-2 ${
                k.revoked ? "border-zinc-200 bg-zinc-50 opacity-60" : "border-zinc-200 bg-white"
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-zinc-900 text-sm">{k.label}</div>
                  <div className="text-xs text-zinc-500">
                    Created {new Date(k.created_at).toLocaleDateString()}
                    {k.last_used_at && ` · last used ${new Date(k.last_used_at).toLocaleDateString()}`}
                    {k.revoked && " · revoked"}
                  </div>
                </div>
                {!k.revoked && (
                  <div className="flex items-center gap-3 shrink-0">
                    {k.hasStoredToken && !revealed[k.id] && (
                      <button onClick={() => handleReveal(k.id)} className="text-sm text-blue-600 hover:underline">
                        Show
                      </button>
                    )}
                    <button onClick={() => handleRevoke(k.id)} className="text-sm text-red-600 hover:underline">
                      Revoke
                    </button>
                  </div>
                )}
              </div>
              {revealed[k.id] && (
                <code className="text-xs bg-zinc-50 border border-zinc-200 rounded p-2 break-all select-all">
                  {revealed[k.id]}
                </code>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
