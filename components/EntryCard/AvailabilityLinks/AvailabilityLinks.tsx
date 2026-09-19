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
  backup: DateRange;
}

// "Check backup dates" next to a Stay Option's own title — one click
// straight into the listing's real availability for the trip's backup
// week. Nothing to show for a url this app doesn't know a date-param
// convention for (see lib/listingAvailability.ts).
export default function AvailabilityLinks({ url, backup }: AvailabilityLinksProps) {
  if (!url || !isKnownBookingHost(url)) return null;

  return (
    <a href={withAvailabilityDates(url, backup.start, backup.end)} target="_blank" rel="noopener noreferrer" className={styles["link"]}>
      Check backup dates
    </a>
  );
}
