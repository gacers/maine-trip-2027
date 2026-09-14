"use client";

import { useState } from "react";

// Accepts either a bare folder ID or a full Drive folder URL (pasting
// the URL is much more natural than hunting out the ID yourself).
function extractFolderId(input) {
  const trimmed = input.trim();
  const match = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : trimmed;
}

export default function SettingsForm({ settings }) {
  const [folderInput, setFolderInput] = useState(settings?.google_drive_folder_id || "");
  const [siteUrl, setSiteUrl] = useState(settings?.site_url || "");
  const [contactEmail, setContactEmail] = useState(settings?.contact_email || "");
  const [airbnbCookie, setAirbnbCookie] = useState(settings?.airbnb_session_cookie || "");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          googleDriveFolderId: extractFolderId(folderInput),
          siteUrl: siteUrl.replace(/\/$/, ""),
          contactEmail: contactEmail.trim(),
          airbnbSessionCookie: airbnbCookie.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      setFolderInput(data.settings.google_drive_folder_id || "");
      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-medium text-zinc-700">Trip export folder</h2>
        <p className="text-xs text-zinc-500">
          Every trip&apos;s auto-generated Google Sheet gets created inside this Google Drive
          folder. Change it anytime — future exports use the new folder; existing trips keep the
          Sheet they already have.
        </p>
        <input
          value={folderInput}
          onChange={(e) => setFolderInput(e.target.value)}
          placeholder="Paste a Drive folder URL or ID"
          className="rounded border border-zinc-300 px-2 py-1.5 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-medium text-zinc-700">Site URL</h2>
        <p className="text-xs text-zinc-500">
          Used to build the links back to the live site from each trip&apos;s exported Sheet.
        </p>
        <input
          value={siteUrl}
          onChange={(e) => setSiteUrl(e.target.value)}
          placeholder="https://www.example.com"
          className="rounded border border-zinc-300 px-2 py-1.5 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-medium text-zinc-700">Access request email</h2>
        <p className="text-xs text-zinc-500">
          Shown to visitors without an invite link as who to email for access — see the
          &quot;Request access&quot; button on a trip page.
        </p>
        <input
          type="email"
          value={contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
          placeholder="you@example.com"
          className="rounded border border-zinc-300 px-2 py-1.5 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-medium text-zinc-700">Airbnb session cookie</h2>
        <p className="text-xs text-zinc-500">
          Confirmed live: Airbnb blocks anonymous requests for some listings but serves them
          normally to a real logged-in session. Log into airbnb.com in your own browser, open
          DevTools → Network tab, click any request to airbnb.com, copy the full &quot;cookie&quot;
          request header value, and paste it here. It will expire eventually — if listings that
          used to work start failing again, just refresh it here, no code change needed. Treat this
          like a password: anyone with it can act as your Airbnb account.
        </p>
        <textarea
          value={airbnbCookie}
          onChange={(e) => setAirbnbCookie(e.target.value)}
          placeholder="Paste the full cookie header value..."
          rows={3}
          className="rounded border border-zinc-300 px-2 py-1.5 font-mono text-xs"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm text-green-700">Saved.</p>}

      <button
        type="submit"
        disabled={saving}
        className="rounded bg-zinc-900 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save"}
      </button>
    </form>
  );
}
