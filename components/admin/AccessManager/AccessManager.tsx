"use client";

import { useState } from "react";
import EditorsManager from "@/components/admin/EditorsManager";
import InviteLinksManager from "@/components/admin/InviteLinksManager";
import type { Trip } from "@/lib/types";
import styles from "./AccessManager.module.css";

export interface AccessManagerProps {
  trip: Trip;
}

// Everyone who currently has some form of standing access to this trip
// (permanent editors, invite links, and — mixed into that same invite-
// link list, since it's just another contributor-role api_keys row —
// the Sheet's own embedded token) in one place, plus the one bulk
// action that cuts all of it off at once. Owns a refreshKey so
// "Revoke all" can force both child managers to re-fetch afterward
// (remounting via `key` — simplest way to make two independent,
// self-fetching children pick up a change neither of them caused).
export default function AccessManager({ trip }: AccessManagerProps) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [revoking, setRevoking] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleRevokeAll() {
    if (
      !window.confirm(
        "Revoke ALL access to this trip? Every permanent editor and every invite link (including the one embedded in the Google Sheet) stops working immediately. This can't be undone — you'd need to re-invite people and re-export/rotate the Sheet afterward."
      )
    ) {
      return;
    }
    setRevoking(true);
    setMessage("");
    setError("");
    try {
      const res = await fetch(`/api/trips/${trip.slug}/revoke-all-access`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Revoke failed");
      setMessage(
        `Done — removed ${data.editorsRevoked} editor${data.editorsRevoked === 1 ? "" : "s"} and revoked ${data.keysRevoked} link${data.keysRevoked === 1 ? "" : "s"}.`
      );
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRevoking(false);
    }
  }

  return (
    <div className={styles["root"]}>
      <div className={styles["revoke-all-row"]}>
        <button onClick={handleRevokeAll} disabled={revoking} className={styles["revoke-all-button"]}>
          {revoking ? "Revoking..." : "Revoke all access"}
        </button>
        {message && <p className={styles["message"]}>{message}</p>}
        {error && <p className={styles["error"]}>{error}</p>}
      </div>

      <div className={styles["section"]}>
        <h2 className={styles["subheading"]}>Invite links</h2>
        <InviteLinksManager key={`invites-${refreshKey}`} trip={trip} />
      </div>

      <div className={styles["section"]}>
        <h2 className={styles["subheading"]}>Editors</h2>
        <EditorsManager key={`editors-${refreshKey}`} trip={trip} />
      </div>
    </div>
  );
}
