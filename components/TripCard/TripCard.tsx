import Link from "next/link";
import { Calendar } from "lucide-react";
import type { Trip } from "@/lib/types";
import styles from "./TripCard.module.css";

export interface TripCardProps {
  trip: Pick<Trip, "slug" | "name" | "cover_image" | "start_date" | "end_date">;
  dateLabel: string | null;
}

// A full-bleed photo card — the trip's name and date range overlaid on
// its own cover image (see TripSettingsForm), title on top, dates
// underneath, both sitting on a bottom gradient scrim for legibility.
// A trip with no cover image yet still renders (a plain gradient tile)
// rather than being skipped or looking broken.
export default function TripCard({ trip, dateLabel }: TripCardProps) {
  return (
    <Link href={`/${trip.slug}`} className={styles.card}>
      <div className={styles.photoFrame}>
        {trip.cover_image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={trip.cover_image} alt="" className={styles.photo} />
        ) : (
          <div className={styles.photoFallback} />
        )}
        <div className={styles.scrim} />
        <div className={styles.textBlock}>
          <div className={styles.name}>{trip.name}</div>
          <div className={styles.dateRow}>
            <Calendar size={14} />
            <span>{dateLabel || "Dates TBD"}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
