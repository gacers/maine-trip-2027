"use client";

import { useState } from "react";
import { withAvailabilityDates, isKnownBookingHost } from "@/lib/listingAvailability";
import styles from "./AvailabilityLinks.module.css";

export interface DateRange {
  start: string;
  end: string;
}

export interface AvailabilityLinksProps {
  url: string | null;
  /** Trip.alt_start_date/alt_end_date — the primary range doesn't need
   * its own link here, it's baked straight into the entry's own title
   * link instead (see EntryCard's titleHref) since there's only ever
   * one of those to show. A backup range needs a second link, since a
   * single <a> can only point to one url at a time. */
  backup?: DateRange | null;
}

// "Check backup dates" (when a backup range is actually set) plus an
// always-available "Check other dates" toggle — Airbnb/VRBO have no
// concept of "browse a whole month," only one exact check-in/check-out
// pair per link (confirmed against real listings), so this is the
// closest equivalent: pick any two dates on the spot, get a real link
// straight to that exact range. Nothing persisted — a scratch value,
// forgotten the moment this collapses again, not a third saved trip
// setting alongside primary/backup. Nothing to show at all for a url
// this app doesn't know a date-param convention for (see
// lib/listingAvailability.ts).
export default function AvailabilityLinks({ url, backup }: AvailabilityLinksProps) {
  const [expanded, setExpanded] = useState(false);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  if (!url || !isKnownBookingHost(url)) return null;

  const customHref = customStart && customEnd ? withAvailabilityDates(url, customStart, customEnd) : null;

  return (
    <span className={styles["root"]}>
      {backup && (
        <a href={withAvailabilityDates(url, backup.start, backup.end)} target="_blank" rel="noopener noreferrer" className={styles["link"]}>
          Check backup dates
        </a>
      )}
      <button type="button" onClick={() => setExpanded((e) => !e)} className={styles["toggle"]}>
        {expanded ? "Hide other dates" : "Check other dates"}
      </button>
      {expanded && (
        <span className={styles["custom-row"]}>
          <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className={styles["date-input"]} />
          <span className={styles["arrow"]}>→</span>
          <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className={styles["date-input"]} />
          {customHref && (
            <a href={customHref} target="_blank" rel="noopener noreferrer" className={styles["link"]}>
              Check
            </a>
          )}
        </span>
      )}
    </span>
  );
}
