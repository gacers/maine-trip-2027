"use client";

import { useState } from "react";

// Shown in place of the Add form to a visitor with no invite link (and
// no admin session) — the only way for them to get one is to ask, so
// this builds a mailto: instead of standing up a real backend email
// flow (no new provider, no API key, nothing that can fail to
// deliver silently). The trip owner replies with an invite link
// generated from InviteLinksManager.
export default function RequestAccess({ trip, section, contactEmail }) {
  const [message, setMessage] = useState("");
  const [expanded, setExpanded] = useState(false);

  if (!contactEmail) return null;

  const subject = `Access request: ${trip.name}`;
  const bodyLines = [
    `Hi — I'd like to add to the "${section.label}" list for ${trip.name}.`,
    message.trim(),
    "",
    `Page: ${typeof window !== "undefined" ? window.location.href : ""}`,
  ].filter(Boolean);
  const mailtoHref = `mailto:${contactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(
    bodyLines.join("\n")
  )}`;

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="text-sm text-blue-600 hover:underline self-start"
      >
        Want to add something here? Request access
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 sm:p-5 shadow-sm flex flex-col gap-3">
      <p className="text-sm text-zinc-600">
        This opens your email app with a message to the trip owner asking for an invite link.
      </p>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Anything you want to mention (optional)"
        rows={2}
        className="rounded border border-zinc-300 px-2 py-1.5 text-sm"
      />
      <div className="flex gap-3">
        <a
          href={mailtoHref}
          className="rounded bg-zinc-900 text-white px-4 py-2 text-sm font-medium"
        >
          Open email to request access
        </a>
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="text-sm text-zinc-500 hover:underline"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
