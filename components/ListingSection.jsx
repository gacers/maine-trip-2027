"use client";

import { useState } from "react";

// `rank`/`onRankChange` are only passed for a 2-house-option group, where
// the pair shares a single rank instead of each card having its own.
// `badges` (an entry's true boolean fields, e.g. "Closed") render next
// to the title here rather than inside EntryCard's own body whenever
// this component — not EntryCard — is the one actually showing the
// title (a solo, non-grouped entry passes its title/href here and hides
// its own via showTitle={false}; see SectionPage).
export default function ListingSection({ title, children, id, href, rank, onRankChange, badges }) {
  const [rankDraft, setRankDraft] = useState(rank ?? "");

  function commitRank() {
    const n = Number(rankDraft);
    if (!Number.isNaN(n) && n !== rank && onRankChange) {
      onRankChange(n);
    }
  }

  return (
    <section id={id} className="rounded-xl border border-zinc-300 bg-white shadow-sm overflow-hidden">
      <div className="bg-zinc-50 border-b border-zinc-300 px-4 sm:px-5 py-2.5 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 flex items-start justify-between gap-2">
          <h2 className="font-semibold text-zinc-900 break-words">
            {href ? (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-blue-600 hover:underline decoration-blue-400"
              >
                {title}
              </a>
            ) : (
              title
            )}
          </h2>
          {badges?.length > 0 && (
            <div className="flex flex-wrap justify-end gap-1 shrink-0">
              {badges.map((b) => (
                <span
                  key={b.key}
                  className="inline-block rounded-full bg-amber-100 text-amber-800 text-xs font-medium px-2 py-0.5"
                >
                  {b.label}
                </span>
              ))}
            </div>
          )}
        </div>
        {rank !== undefined && (
          <div className="flex flex-col items-end gap-1 shrink-0">
            <label className="text-xs text-zinc-500">Rank</label>
            <input
              type="number"
              value={rankDraft}
              onChange={(e) => setRankDraft(e.target.value)}
              onBlur={commitRank}
              className="w-16 rounded border border-zinc-300 px-2 py-1 text-sm text-center"
            />
          </div>
        )}
      </div>
      <div className="p-4 sm:p-5 flex flex-col gap-4">{children}</div>
    </section>
  );
}
