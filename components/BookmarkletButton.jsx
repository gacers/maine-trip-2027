"use client";

import { buildBookmarkletHref } from "@/lib/bookmarklet";

// A one-time-setup tool, not a per-add action — rendered once per
// section so it always lands on that section's own Add form.
// `inviteToken`, when given, gets baked into the destination link so a
// contributor's browser stays recognized there the same way any other
// invite link works (see lib/inviteClient.js) — omit it for an admin,
// whose session cookie already covers this.
export default function BookmarkletButton({ trip, section, inviteToken }) {
  const destination =
    `${typeof window !== "undefined" ? window.location.origin : ""}/${trip.slug}/${section.slug}` +
    (inviteToken ? `?invite=${encodeURIComponent(inviteToken)}` : "");
  const href = buildBookmarkletHref(destination);

  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 flex flex-col gap-1.5 text-sm">
      <p className="text-zinc-700">
        <span className="font-medium">Add from your browser:</span> drag this to your bookmarks bar, then click
        it while viewing any listing (Airbnb, a restaurant, anywhere) to bring its details here instantly — it
        reads the page you&apos;re already looking at, so it works even for listings this site can&apos;t fetch
        on its own.
      </p>
      <a
        href={href}
        draggable
        onClick={(e) => {
          e.preventDefault();
          alert("Drag this button up to your bookmarks bar instead of clicking it.");
        }}
        className="self-start rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 cursor-grab hover:bg-zinc-100"
      >
        📌 Add to {section.label}
      </a>
    </div>
  );
}
