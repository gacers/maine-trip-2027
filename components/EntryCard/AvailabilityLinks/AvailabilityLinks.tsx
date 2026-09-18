import { withAvailabilityDates, isKnownBookingHost } from "@/lib/listingAvailability";
import styles from "./AvailabilityLinks.module.css";

export interface DateRange {
  start: string;
  end: string;
}

export interface AvailabilityLinksProps {
  url: string | null;
  /** Trip.start_date/end_date. */
  primary?: DateRange | null;
  /** Trip.alt_start_date/alt_end_date — a fallback week, only shown
   * once both are actually set. */
  backup?: DateRange | null;
}

// "Check dates"/"Check backup dates" next to a Stay Option's own title
// — one click straight into the listing's real availability for the
// trip's own (or backup) dates, instead of a bare listing page still
// needing them picked by hand. Nothing to show for a url this app
// doesn't know a date-param convention for (see
// lib/listingAvailability.ts), or when neither range is set.
export default function AvailabilityLinks({ url, primary, backup }: AvailabilityLinksProps) {
  if (!url || !isKnownBookingHost(url)) return null;
  if (!primary && !backup) return null;

  return (
    <span className={styles["root"]}>
      {primary && (
        <a href={withAvailabilityDates(url, primary.start, primary.end)} target="_blank" rel="noopener noreferrer" className={styles["link"]}>
          Check dates
        </a>
      )}
      {backup && (
        <a href={withAvailabilityDates(url, backup.start, backup.end)} target="_blank" rel="noopener noreferrer" className={styles["link"]}>
          Check backup dates
        </a>
      )}
    </span>
  );
}
