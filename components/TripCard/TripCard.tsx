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
  /** Defaults to /{slug}; home passes the first section path instead. */
  href?: string;
}

export default function TripCard({ trip, dateLabel, href }: TripCardProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const showPhoto = trip.cover_image && !imageFailed;
  return (
    <Link href={href || `/${trip.slug}`} className={styles["root"]}>
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
