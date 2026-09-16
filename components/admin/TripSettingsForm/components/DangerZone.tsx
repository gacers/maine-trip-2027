"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/Button";
import type { Trip } from "@/lib/types";
import styles from "./DangerZone.module.css";

export interface DangerZoneProps {
  trip: Trip;
}

// Permanently deletes the trip — everything under it (nav groups,
// sections, field defs, entries, ratings, API keys) cascades via the
// DB's own `on delete cascade` (see supabase/migrations/0001_init.sql),
// so this one call is enough. Deliberately NOT bundled into the rest of
// the settings form's "Save changes" — the two other toggles up there
// (Completed, Archived) are both reversible; this one isn't, so it gets
// its own explicit action and its own harder confirmation (typing the
// trip's exact name) rather than the site's usual one-click "Delete for
// good?" pattern used for a single entry. Doesn't touch the trip's
// Google Sheet, if it has one — that's a separate Google resource this
// app doesn't own the lifecycle of.
export default function DangerZone({ trip }: DangerZoneProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete() {
    setDeleting(true);
    setError("");
    try {
      const res = await fetch(`/api/trips/${trip.slug}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Delete failed");
      }
      router.push("/");
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
        // Wrapped, not bare — a bare Button here gets stretched to
        // .root's full width by the flex column's default
        // align-items, centering its own label instead of sitting
        // left-aligned like the "Danger zone" heading above it.
        <div>
          <Button variant="danger" size="sm" onClick={() => setConfirming(true)}>
            Delete this trip
          </Button>
        </div>
      ) : (
        <div className={styles["confirm-box"]}>
          <p className={styles["warning"]}>
            Permanently deletes &quot;{trip.name}&quot; and everything in it. No undo — unlike Archive. Type the
            trip&apos;s name to confirm.
          </p>
          <input
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            placeholder={trip.name}
            className={styles["confirm-input"]}
          />
          {error && <p className={styles["error"]}>{error}</p>}
          <div className={styles["confirm-actions"]}>
            <Button
              variant="danger"
              size="sm"
              disabled={nameInput !== trip.name || deleting}
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
