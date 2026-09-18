import type { SupabaseClient } from "@supabase/supabase-js";
import type { docs_v1 } from "googleapis";
import { getDocsClient } from "@/lib/googleDocsAuth";
import { createDocInDrive, getOrCreateTripFolder } from "@/lib/drive";
import { getStopsForTrip } from "@/lib/itineraryStops";
import { getOrComputeRoute } from "@/lib/routeCache";
import { toGoogleTravelMode, ITINERARY_TRAVEL_MODE_CONNECTOR_LABEL } from "@/lib/itineraryTravelMode";
import { formatDuration } from "@/lib/formatDuration";
import type { Trip, ItineraryStop } from "@/lib/types";

export interface ExportResult {
  docId: string;
  docUrl: string;
}

const KIND_LABEL: Record<string, string> = {
  lodging: "Lodging",
  activity: "Activity",
  meal: "Meal",
  bar: "Bar",
  transport: "Transport",
  other: "Other",
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function formatDay(date: string | null): string {
  if (!date) return "Unscheduled";
  const d = new Date(`${date}T00:00:00`);
  return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}

function formatTime(time: string | null): string | null {
  if (!time) return null;
  const [h, m] = time.slice(0, 5).split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${pad(m)} ${period}`;
}

function mapsSearchUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

export interface StyleRun {
  start: number;
  end: number;
  style: "title" | "day" | "bold" | "italic" | "bullet" | "block-end" | "link";
  /** Only meaningful for "link" runs. */
  url?: string;
}

/** One consumed leading tab (see the "bullet" run's own call site) —
 * `count` is how many tabs that specific paragraph started with (1 for
 * a stop's Kind/"Notes:" line, 2 for an individual note line nested
 * under "Notes:"), since createParagraphBullets consumes ALL of them
 * at once, not just one. */
interface TabConsumption {
  position: number;
  count: number;
}

// Builds the whole doc body as one plain-text string plus a list of
// style runs (character ranges into that same string) — one insertText
// covering the full text, then one paragraph/text-style request per
// run, is far simpler than trying to insert and style paragraph by
// paragraph one at a time. ✓-confirmed stops read as the normal/solid
// entry; tentative/archived are italicized (Docs' nearest equivalent
// to "dimmed") rather than hidden — same "keep discarded options
// visible" posture as the web page itself.
//
// Async now (was pure text-building before) — computing the drive-
// time/leave-by line between two coordinate-bearing stops needs a real
// Directions lookup, same cached one the site's own RouteConnector
// uses (see lib/routeCache.ts): the whole *combined* app usage for a
// given stop-pair still only ever asks Google once (until that mode's
// TTL expires), whether that first ask came from someone viewing the
// page or someone clicking Export.
export async function buildDocContent(
  supabase: SupabaseClient,
  tripName: string,
  stops: ItineraryStop[]
): Promise<{ text: string; runs: StyleRun[]; tabConsumptions: TabConsumption[] }> {
  let text = "";
  const runs: StyleRun[] = [];
  // Every leading-tab run inserted for a nested bullet (see the
  // "bullet" run's own call site) — requestsFromContent needs these to
  // correctly translate later ranges once each run of tabs gets
  // consumed by its own createParagraphBullets call.
  const tabConsumptions: TabConsumption[] = [];
  const append = (s: string) => {
    text += s;
  };
  const mark = (start: number, style: StyleRun["style"], url?: string) => runs.push({ start, end: text.length, style, url });

  let start = text.length;
  append(`${tripName} — Itinerary\n\n`);
  mark(start, "title");

  let lastDate: string | null | undefined;
  let sawAnyDate = false;

  for (let i = 0; i < stops.length; i++) {
    const stop = stops[i];
    const nextStop = i + 1 < stops.length ? stops[i + 1] : null;

    if (stop.date !== lastDate) {
      lastDate = stop.date;
      sawAnyDate = true;
      start = text.length;
      append(`${formatDay(stop.date)}\n`);
      mark(start, "day");
    }

    const time = formatTime(stop.time);
    const prefix = stop.status === "confirmed" ? "✓ " : "";
    const suffix = stop.status === "archived" ? "  (archived)" : stop.status === "tentative" ? "  (tentative)" : "";
    const titleLine = `${time ? `${time} — ` : ""}${prefix}${stop.title}${suffix}`;
    const titleParaStart = text.length;
    append(titleLine);
    mark(titleParaStart, stop.status === "confirmed" ? "bold" : "italic");

    // A real link, not just a URL printed as text — the stop's own
    // link when it has one (its linked entry's own site, or a custom
    // stop's own URL), falling back to a Google Maps search on its
    // coordinates so there's still SOME way to get directions from the
    // doc alone, without the itinerary page open alongside it.
    const directionsUrl = stop.url || (stop.lat != null && stop.lng != null ? mapsSearchUrl(stop.lat, stop.lng) : null);
    if (directionsUrl) {
      const linkStart = text.length;
      append("  (directions)");
      mark(linkStart, "link", directionsUrl);
    }
    append("\n");

    // The Kind label ("Activity"/"Meal"/etc.), and each note line
    // under its own "Notes:" label, as genuine CHILD bullets nested
    // under the title's own bullet — not just indented plain text —
    // matching the literal "hit enter, tab over one space" gesture
    // that'd take by hand in the Docs UI. That gesture is literally
    // what Docs' own nesting inference keys off of: a single
    // createParagraphBullets call spanning every paragraph below
    // counts each one's own LEADING TAB characters to decide its
    // level (confirmed live — a plain indentStart/indentFirstLine
    // difference alone, tried first, was NOT enough; every paragraph
    // came back at level 0). Kind and "Notes:" get one tab (level 1,
    // siblings under the title); each individual note line gets two
    // (level 2, nested under "Notes:") — matching the reference
    // itinerary doc's own outline shape exactly, natural nesting
    // indents and all (deliberately NOT forced back to any fixed
    // column — a real Docs outline level is supposed to read as
    // visually deeper too). The leading tabs themselves get consumed
    // into each bullet's own nesting, not left behind as visible text.
    const metaBits = [KIND_LABEL[stop.kind] || stop.kind];
    if (stop.duration_minutes) metaBits.push(formatDuration(stop.duration_minutes));
    const kindStart = text.length;
    tabConsumptions.push({ position: kindStart, count: 1 });
    append(`\t${metaBits.join(" · ")}\n`);
    let lastBlockLineStart = kindStart;

    const noteLines = (stop.notes || "")
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (noteLines.length > 0) {
      const notesLabelStart = text.length;
      tabConsumptions.push({ position: notesLabelStart, count: 1 });
      append(`\tNotes:\n`);
      for (const line of noteLines) {
        const lineStart = text.length;
        tabConsumptions.push({ position: lineStart, count: 2 });
        append(`\t\t${line}\n`);
        lastBlockLineStart = lineStart;
      }
    }

    // The drive-time/leave-by line to the NEXT stop — as this stop's
    // own last child bullet (level 1, same combined createParagraphBullets
    // call as Kind/"Notes:" above) rather than a standalone paragraph
    // or its own separate list. Tried both of those first: a plain
    // paragraph with manually-set indentFirstLine/indentStart never
    // actually rendered at the column the API's own readback said it
    // would (confirmed live via a real screenshot, still flush left);
    // its own separate bulleted list (even with a distinct preset to
    // dodge Docs' adjacent-list auto-merge) still read as visually
    // disconnected — too much space above it, not enough below,
    // because it wasn't actually part of the block it belongs to. This
    // is simpler AND fixes that: no separate call, no separate list,
    // just one more tab-1 paragraph before this stop's own trailing
    // blank line — same conditions the site's own list view uses (both
    // sides need coordinates, AND never across a day boundary: a new
    // day's first stop is where you're starting from, not somewhere
    // you just traveled to from yesterday's last stop).
    let connectorStart: number | null = null;
    if (
      nextStop &&
      nextStop.date === stop.date &&
      stop.lat != null &&
      stop.lng != null &&
      nextStop.lat != null &&
      nextStop.lng != null
    ) {
      const route = await getOrComputeRoute(
        supabase,
        { lat: stop.lat, lng: stop.lng },
        { lat: nextStop.lat, lng: nextStop.lng },
        toGoogleTravelMode(nextStop.travel_mode)
      ).catch(() => null);
      if (route) {
        let line = `↓ ${route.text} ${ITINERARY_TRAVEL_MODE_CONNECTOR_LABEL[nextStop.travel_mode]}`;
        if (nextStop.time) {
          const arrival = new Date(`${nextStop.date}T${nextStop.time.slice(0, 5)}:00`);
          if (!Number.isNaN(arrival.getTime())) {
            const leaveBy = new Date(arrival.getTime() - route.durationSeconds * 1000);
            line += ` — leave by ${leaveBy.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
          }
        }
        connectorStart = text.length;
        tabConsumptions.push({ position: connectorStart, count: 1 });
        append(`\t${line}\n`);
        mark(connectorStart, "italic");
      }
    }

    mark(titleParaStart, "bullet");
    mark(connectorStart ?? lastBlockLineStart, "block-end");
    append("\n");
  }

  if (!sawAnyDate && stops.length === 0) {
    append("Nothing on the itinerary yet.\n");
  }

  return { text, runs, tabConsumptions };
}

// Docs body content starts at index 1 — a run at [start, end) in the
// plain-text string above maps to document range [1+start, 1+end)
// once that whole string has been inserted at index 1.
function requestsFromContent(text: string, runs: StyleRun[], tabConsumptions: TabConsumption[]): docs_v1.Schema$Request[] {
  const requests: docs_v1.Schema$Request[] = [{ insertText: { location: { index: 1 }, text } }];
  // createParagraphBullets on a paragraph that starts with leading
  // tabs (used to signal nesting depth — see the "bullet" run's own
  // call site) consumes ALL of them as part of establishing the
  // nesting level instead of leaving them as visible text, shrinking
  // every index AFTER by that many — confirmed live: an uncorrected
  // batch failed with an out-of-bounds range on a later request, off
  // by exactly the number of nested-bullet tabs already applied
  // earlier in the same batch. shiftFor(i) sums consumed tabs at
  // positions STRICTLY BEFORE i (not <=) — the "<=" version looked
  // right at first too, but is off for a boundary that sits exactly AT
  // a tab run's own position (a "block-end"/"bullet" run's own start,
  // always == that paragraph's own tab position): removing characters
  // collapses the boundary just-before them and just-after them into
  // the same new position, so a boundary AT the removed characters is
  // unaffected by that specific removal, only by earlier ones.
  const sorted = [...tabConsumptions].sort((a, b) => a.position - b.position);
  function shiftFor(index: number): number {
    let count = 0;
    for (const c of sorted) {
      if (c.position < index) count += c.count;
      else break;
    }
    return count;
  }
  for (const run of runs) {
    const range = { startIndex: 1 + run.start - shiftFor(run.start), endIndex: 1 + run.end - shiftFor(run.end) };
    if (run.style === "title") {
      requests.push({ updateParagraphStyle: { range, paragraphStyle: { namedStyleType: "TITLE" }, fields: "namedStyleType" } });
    } else if (run.style === "day") {
      requests.push({ updateParagraphStyle: { range, paragraphStyle: { namedStyleType: "HEADING_2" }, fields: "namedStyleType" } });
    } else if (run.style === "bold") {
      requests.push({ updateTextStyle: { range, textStyle: { bold: true }, fields: "bold" } });
    } else if (run.style === "italic") {
      requests.push({
        updateTextStyle: {
          range,
          textStyle: { italic: true, foregroundColor: { color: { rgbColor: { red: 0.45, green: 0.45, blue: 0.45 } } } },
          fields: "italic,foregroundColor",
        },
      });
    } else if (run.style === "bullet") {
      requests.push({
        createParagraphBullets: { range, bulletPreset: "BULLET_DISC_CIRCLE_SQUARE" },
      });
    } else if (run.style === "block-end") {
      // A little space below whichever line is actually LAST in this
      // stop's own bulleted block (Kind, if there are no notes — the
      // last note line otherwise) — it sits jammed against the next
      // stop's connector line otherwise (the blank paragraph between
      // stops only separates the END of one stop's block from the
      // NEXT stop's connector, not this stop's own last line from that
      // connector). Deliberately no indent override here — see the
      // "bullet" run's own comment for why every nested line keeps its
      // natural, progressively-deeper Docs indent instead of being
      // forced back to one shared column.
      requests.push({
        updateParagraphStyle: {
          range,
          paragraphStyle: { spaceBelow: { magnitude: 6, unit: "PT" } },
          fields: "spaceBelow",
        },
      });
    } else if (run.style === "link" && run.url) {
      requests.push({
        updateTextStyle: {
          range,
          textStyle: { link: { url: run.url }, foregroundColor: { color: { rgbColor: { red: 0.06, green: 0.36, blue: 0.77 } } } },
          fields: "link,foregroundColor",
        },
      });
    }
  }
  return requests;
}

// Explicit-only (no auto-export on every stop write, unlike the Sheets
// export) — an itinerary doc is an occasional "get me something to
// share" action, not a live sync, so there's just this one throwing
// version: a real failure should reach whoever clicked the button.
// Always a full regenerate (delete existing body, reinsert), not an
// incremental diff — simplest, and matches "regenerate a plan" rather
// than "keep a live-synced spreadsheet."
export async function exportItineraryOrThrow(supabase: SupabaseClient, trip: Trip): Promise<ExportResult> {
  const stops = await getStopsForTrip(supabase, trip.id);

  let docId = trip.google_itinerary_doc_id;
  let docUrl = trip.google_itinerary_doc_url;

  if (!docId) {
    // Groups this trip's Doc with its own Sheet (if it has one) in one
    // subfolder instead of every trip's files sitting flat as siblings
    // — see getOrCreateTripFolder's own comment.
    const tripFolderId = await getOrCreateTripFolder(supabase, trip);
    const created = await createDocInDrive(`${trip.name} — Itinerary`, tripFolderId);
    docId = created.id;
    docUrl = created.url;
    await supabase.from("trips").update({ google_itinerary_doc_id: docId, google_itinerary_doc_url: docUrl }).eq("id", trip.id);
  }

  const docs = await getDocsClient();

  const existing = await docs.documents.get({ documentId: docId! });
  const content = existing.data.body?.content || [];
  const endIndex = content.length > 0 ? content[content.length - 1].endIndex || 1 : 1;

  const requests: docs_v1.Schema$Request[] = [];
  // A brand-new (or already-emptied) doc's body is just one empty
  // paragraph -- endIndex 2 -- with nothing real to delete; anything
  // beyond that is previous export content to clear before rewriting.
  if (endIndex > 2) {
    requests.push({ deleteContentRange: { range: { startIndex: 1, endIndex: endIndex - 1 } } });
  }

  const { text, runs, tabConsumptions } = await buildDocContent(supabase, trip.name, stops);
  requests.push(...requestsFromContent(text, runs, tabConsumptions));

  await docs.documents.batchUpdate({ documentId: docId!, requestBody: { requests } });

  return { docId: docId!, docUrl: docUrl! };
}
