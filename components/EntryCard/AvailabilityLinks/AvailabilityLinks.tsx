"use client";

import { useState } from "react";
import DateRangeFields from "@/components/DateRangeFields";
import { withAvailabilityDates, isKnownBookingHost } from "@/lib/listingAvailability";
import styles from "./AvailabilityLinks.module.css";

export interface DateRange {
  start: string;
  end: string;
}

export interface AvailabilityLinksProps {
  url: string | null;
  /** Trip.start_date/end_date — the trip's actual planned dates, when
   * set. */
  primary?: DateRange | null;
  /** Trip.alt_start_date/alt_end_date — a fallback week, if there is
   * one. */
  backup?: DateRange | null;
}

// "Check trip dates"/"Check backup dates" (whichever of the trip's own
// ranges are actually set) plus an always-available toggle for picking
// any arbitrary range on the spot — labeled "Check other dates" once
// there's already a "Check trip dates" link above it to be an
// alternative to, or plain "Check dates" when there isn't (no trip
// dates set yet — this toggle is then the only way to check dates at
// all, not a secondary one). Airbnb/VRBO have no concept of "browse a
// whole month," only one exact check-in/check-out pair per link
// (confirmed against real listings), so this is the closest
// equivalent. The toggle's own pair is nothing persisted — a scratch
// value, forgotten the moment this collapses again, not a third saved
// trip setting alongside primary/backup. Nothing to show at all for a
// url this app doesn't know a date-param convention for (see
// lib/listingAvailability.ts).
export default function AvailabilityLinks({ url, primary, backup }: AvailabilityLinksProps) {
  const [expanded, setExpanded] = useState(false);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  if (!url || !isKnownBookingHost(url)) return null;

  const customHref = customStart && customEnd ? withAvailabilityDates(url, customStart, customEnd) : null;
  // Without a trip date range to check first, this toggle's own
  // arbitrary-date picker IS the "check dates" control, not a
  // secondary/"other" one alongside it.
  const toggleLabel = primary ? "other dates" : "dates";

  return (
    <span className={styles["root"]}>
      {primary && (
        <a href={withAvailabilityDates(url, primary.start, primary.end)} target="_blank" rel="noopener noreferrer" className={styles["link"]}>
          Check trip dates
        </a>
      )}
      {backup && (
        <a href={withAvailabilityDates(url, backup.start, backup.end)} target="_blank" rel="noopener noreferrer" className={styles["link"]}>
          Check backup dates
        </a>
      )}
      <button type="button" onClick={() => setExpanded((e) => !e)} className={styles["toggle"]}>
        {expanded ? `Hide ${toggleLabel}` : `Check ${toggleLabel}`}
      </button>
      {expanded && (
        <span className={styles["custom-row"]}>
          <DateRangeFields
            layout="inline"
            start={customStart}
            end={customEnd}
            onStartChange={setCustomStart}
            onEndChange={setCustomEnd}
            inputClassName={styles["date-input"]}
            arrowClassName={styles["arrow"]}
          />
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
