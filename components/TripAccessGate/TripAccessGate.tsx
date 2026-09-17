"use client";

import { useEffect, useState, type ReactNode } from "react";
import { captureInviteToken } from "@/lib/inviteClient";
import LoginPrompt from "@/components/LoginPrompt";
import RequestAccess from "@/components/RequestAccess";
import type { PublicTrip } from "@/lib/types";
import styles from "./TripAccessGate.module.css";

export interface TripAccessGateProps {
  trip: PublicTrip;
  isAdmin: boolean;
  isEditor: boolean;
  contactEmail: string | null;
  children: ReactNode;
}

// Blocks a total stranger — neither a real login (admin/editor) nor an
// invite link's token for this trip — from seeing anything under the
// nav bar: no map, no listing cards, nothing. TripNavHeader itself
// still renders regardless (trip name, category tabs) — none of that
// is actually private, and it's what makes this read as "locked" rather
// than "broken" (see the plan this was built from for why that split
// was chosen over hiding the nav too).
//
// An invite token only lives in this browser's localStorage (see
// lib/inviteClient.ts), so it's not knowable during the server render
// that produced isAdmin/isEditor — there's necessarily one client tick
// where neither the real content nor this gate's own blocked screen
// has rendered yet. Nothing shows during that tick (`checked` stays
// false) rather than flashing the blocked screen at someone who
// actually does have a stored token. For an admin/editor, `checked`
// starts true immediately — that part IS known at render time, no
// flash to avoid.
//
// This is a client-side/UX gate, not a hardened one — the underlying
// API routes this trip's data comes from were already open reads
// before this (see e.g. the entries GET route), matching the app's
// existing "friendly, not fortress" model elsewhere (RequestAccess is
// a mailto:, not a real approval queue). What this actually buys: the
// entries fetch itself (see SectionPage/useSectionEntries) only ever
// fires once `children` actually mounts, so a stranger's browser never
// even requests the real content, not just never displays it.
export default function TripAccessGate({ trip, isAdmin, isEditor, contactEmail, children }: TripAccessGateProps) {
  const [checked, setChecked] = useState(isAdmin || isEditor);
  const [hasAccess, setHasAccess] = useState(isAdmin || isEditor);

  useEffect(() => {
    if (isAdmin || isEditor) return;
    const token = captureInviteToken(trip.slug);
    setHasAccess(!!token);
    setChecked(true);
  }, [trip.slug, isAdmin, isEditor]);

  if (!checked) return null;
  if (hasAccess) return <>{children}</>;

  return (
    <div className={styles["root"]}>
      <div className={styles["card"]}>
        <h1 className={styles["title"]}>{trip.name}</h1>
        <p className={styles["hint"]}>This trip is private — log in or request access to see it.</p>
        <div className={styles["actions"]}>
          <LoginPrompt triggerVariant="primary" triggerSize="md" />
          <RequestAccess trip={trip} contactEmail={contactEmail} triggerVariant="secondary" triggerSize="md" />
        </div>
      </div>
    </div>
  );
}
