"use client";

import { useState } from "react";
import Link from "next/link";
import { SECTION_TEMPLATES } from "@/lib/sectionTemplates";

export default function SectionsAdmin({ trip, nav: initialNav }) {
  const [nav, setNav] = useState(initialNav);
  const [error, setError] = useState("");
  const [addingTemplate, setAddingTemplate] = useState(null);

  const apiBase = `/api/trips/${trip.slug}/sections`;
  const existingGroupLabels = new Set(nav.map((g) => g.label));

  async function refresh() {
    const res = await fetch(apiBase, { cache: "no-store" });
    const data = await res.json();
    if (res.ok) setNav(data.nav);
  }

  async function toggleEnabled(section, enabled) {
    setError("");
    try {
      const res = await fetch(`${apiBase}/${section.slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Update failed");
      refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function addTemplate(template) {
    setError("");
    setAddingTemplate(template.key);
    // Houses get one full-width card per row (a lot to show: photos,
    // price, bed/bath counts, a map); Food & Drink and Activities read
    // better two to a row — both tiers of a category share this, unlike
    // hasMap which differs between them.
    const compactCards = template.key !== "houses";
    try {
      const possibleRes = await fetch(apiBase, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: template.possible.slug,
          label: template.possible.label,
          addPlaceholder: template.possible.addPlaceholder,
          emptyMessage: template.possible.emptyMessage,
          supportsPairing: true,
          hasMap: true,
          compactCards,
          newNavGroupLabel: template.navGroupLabel,
          fieldDefs: template.fieldDefs,
        }),
      });
      const possibleData = await possibleRes.json();
      if (!possibleRes.ok) throw new Error(possibleData.error || "Failed to create section");

      const previousRes = await fetch(apiBase, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: template.previous.slug,
          label: template.previous.label,
          addPlaceholder: template.previous.addPlaceholder,
          emptyMessage: template.previous.emptyMessage,
          supportsPairing: true,
          // A "previous" list is a record of what's already decided —
          // no ranking or driving-times/map to help pick a winner needed.
          hasMap: false,
          compactCards,
          navGroupId: possibleData.section.nav_group_id,
          fieldDefs: template.fieldDefs,
        }),
      });
      const previousData = await previousRes.json();
      if (!previousRes.ok) {
        throw new Error(
          `Created "${template.possible.label}", but "${template.previous.label}" failed: ${previousData.error || "unknown error"}`
        );
      }

      refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setAddingTemplate(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-zinc-900">Sections</h1>
        <Link
          href={`/${trip.slug}/admin/sections/new`}
          className="rounded bg-zinc-900 text-white px-4 py-2 text-sm font-medium"
        >
          + New section
        </Link>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">{error}</p>}

      <div className="flex flex-col gap-2">
        <h2 className="text-sm uppercase tracking-wide text-zinc-500 font-medium">
          Add from a template
        </h2>
        <p className="text-xs text-zinc-500">
          Each creates a ready-made &quot;Possible&quot; / &quot;Previous&quot; pair — fully editable or
          deletable afterward, this is just a fast starting point.
        </p>
        <div className="flex flex-wrap gap-2">
          {SECTION_TEMPLATES.map((t) => {
            const exists = existingGroupLabels.has(t.navGroupLabel);
            return (
              <button
                key={t.key}
                type="button"
                disabled={exists || addingTemplate === t.key}
                onClick={() => addTemplate(t)}
                className="rounded-full border border-zinc-300 bg-white px-4 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 disabled:hover:bg-white"
                title={exists ? `${t.navGroupLabel} already exists` : undefined}
              >
                {addingTemplate === t.key ? "Adding..." : exists ? `${t.navGroupLabel} ✓` : `+ ${t.navGroupLabel}`}
              </button>
            );
          })}
        </div>
      </div>

      {nav.every((g) => g.sections.length === 0) && (
        <p className="text-zinc-500 text-sm">
          No sections yet — add one from a template above, or create a custom one.
        </p>
      )}

      {nav.map(
        (group) =>
          group.sections.length > 0 && (
            <div key={group.id} className="flex flex-col gap-2">
              <h2 className="text-sm uppercase tracking-wide text-zinc-500 font-medium">
                {group.label}
              </h2>
              <div className="flex flex-col gap-2">
                {group.sections.map((section) => (
                  <div
                    key={section.id}
                    className={`rounded-lg border p-3 flex items-center justify-between ${
                      section.enabled ? "border-zinc-200 bg-white" : "border-zinc-200 bg-zinc-50 opacity-60"
                    }`}
                  >
                    <div>
                      <div className="font-medium text-zinc-900">{section.label}</div>
                      <div className="text-xs text-zinc-500">
                        /{trip.slug}/{section.slug}
                        {!section.enabled && " · disabled"}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1.5 text-xs text-zinc-600">
                        <input
                          type="checkbox"
                          checked={section.enabled}
                          onChange={(e) => toggleEnabled(section, e.target.checked)}
                          className="h-3.5 w-3.5"
                        />
                        Enabled
                      </label>
                      <Link
                        href={`/${trip.slug}/admin/sections/${section.slug}/edit`}
                        className="text-sm text-blue-600 hover:underline"
                      >
                        Edit
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
      )}
    </div>
  );
}
