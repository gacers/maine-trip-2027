"use client";

import { useEffect, useState } from "react";
import type { Trip, TripEditor } from "@/lib/types";
import styles from "./EditorsManager.module.css";

export interface EditorsManagerProps {
  trip: Trip;
}

// Permanent-login editors (see CreateLoginPrompt) previously had no
// admin-facing view at all — an invite link's own contributor token
// shows up in Invite Links above and can be revoked there, but someone
// who'd since created a real login from one was invisible: no list,
// no way to cut off just their access without also killing every
// invite link for everyone else.
export default function EditorsManager({ trip }: EditorsManagerProps) {
  const [editors, setEditors] = useState<TripEditor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const apiBase = `/api/trips/${trip.slug}/editors`;

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(apiBase, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setEditors(data.editors);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBase]);

  async function handleRevoke(userId: string, email: string) {
    if (!window.confirm(`Remove ${email}'s access to this trip? They can still sign in, just not edit anything here.`)) {
      return;
    }
    try {
      const res = await fetch(`${apiBase}/${userId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Revoke failed");
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className={styles["root"]}>
      <p className={styles["intro"]}>
        Everyone with a permanent login on this trip (see &quot;Create a permanent login&quot; on the site itself) —
        separate from the invite links below, which work without signing in at all.
      </p>
      {error && <p className={styles["error"]}>{error}</p>}
      {loading ? (
        <p className={styles["muted"]}>Loading...</p>
      ) : editors.length === 0 ? (
        <p className={styles["muted"]}>No permanent editors yet.</p>
      ) : (
        <div className={styles["list"]}>
          {editors.map((e) => (
            <div key={e.user_id} className={styles["card"]}>
              <div>
                <div className={styles["email"]}>{e.email}</div>
                <div className={styles["meta"]}>
                  Since {new Date(e.created_at).toLocaleDateString()} · last active{" "}
                  {new Date(e.last_active_at).toLocaleDateString()}
                </div>
              </div>
              <button onClick={() => handleRevoke(e.user_id, e.email)} className={styles["revoke-button"]}>
                Revoke
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
