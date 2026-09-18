"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/Button";
import type { PublicTrip, Section } from "@/lib/types";
import styles from "./DangerZone.module.css";

export interface DangerZoneProps {
  trip: PublicTrip;
  navGroupSlug: string;
  section: Section;
}

// Permanently deletes the section — every entry/field_defs row under it
// cascades via the DB's own `on delete cascade` (see
// supabase/migrations/0001_init.sql), so this one call is enough. Same
// "type the exact name to confirm" pattern as TripSettingsForm's own
// DangerZone, for the same reason: this is genuinely irreversible (an
// "Enabled" toggle already covers "hide it without losing anything",
// see SectionOptionsFields) and can take real entries/photos/notes down
// with it, so a single accidental click shouldn't be enough.
export default function DangerZone({ trip, navGroupSlug, section }: DangerZoneProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete() {
    setDeleting(true);
    setError("");
    try {
      const res = await fetch(`/api/trips/${trip.slug}/sections/${navGroupSlug}/${section.slug}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Delete failed");
      }
      router.push(`/${trip.slug}/admin/sections`);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setDeleting(false);
    }
  }

  return (
    <div className={styles["root"]}>
      <h2 className={styles["heading"]}>Danger zone</h2>
      {!confirming ? (
        <div>
          <Button variant="danger" size="sm" onClick={() => setConfirming(true)}>
            Delete this section
          </Button>
        </div>
      ) : (
        <div className={styles["confirm-box"]}>
          <p className={styles["warning"]}>
            Permanently deletes &quot;{section.label}&quot; and every entry in it. No undo — if you just want it
            hidden without losing anything, uncheck Enabled above instead. Type the section&apos;s name to confirm.
          </p>
          <input
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            placeholder={section.label}
            className={styles["confirm-input"]}
          />
          {error && <p className={styles["error"]}>{error}</p>}
          <div className={styles["confirm-actions"]}>
            <Button
              variant="danger"
              size="sm"
              disabled={nameInput !== section.label || deleting}
              onClick={handleDelete}
            >
              {deleting ? "Deleting..." : "Permanently delete"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setConfirming(false);
                setNameInput("");
                setError("");
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
