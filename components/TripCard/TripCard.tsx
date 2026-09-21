"use client";

import { useState } from "react";
import Link from "next/link";
import { Calendar } from "lucide-react";
import Image from "@/components/Image";
import type { Trip } from "@/lib/types";
import styles from "./TripCard.module.css";

export interface TripCardProps {
  trip: Pick<Trip, "slug" | "name" | "cover_image" | "start_date" | "end_date">;
  dateLabel: string | null;
}

// A full-bleed photo card — the trip's name and date range overlaid on
// its own cover image (see TripSettingsForm), title on top, dates
// underneath, both sitting on a bottom gradient scrim for legibility.
// A trip with no cover image yet (or one whose pasted URL has since
// gone stale — there's no real upload, so a hosting site rotating its
// link or a listing coming down is a real risk) still renders a plain
// gradient tile rather than a broken-image icon or being skipped.
export default function TripCard({ trip, dateLabel }: TripCardProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const showPhoto = trip.cover_image && !imageFailed;
  return (
    <Link href={`/${trip.slug}`} className={styles["root"]}>
      <div className={styles["photo-frame"]}>
        {showPhoto ? (
          <Image
            src={trip.cover_image!}
            alt=""
            fill
            sizes="(max-width: 40rem) 100vw, (max-width: 64rem) 50vw, 33vw"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className={styles["photo-fallback"]} />
        )}
        <div className={styles["scrim"]} />
        <div className={styles["text-block"]}>
          <div className={styles["name"]}>{trip.name}</div>
          <div className={styles["date-row"]}>
            <Calendar size={14} />
            <span>{dateLabel || "Dates TBD"}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
