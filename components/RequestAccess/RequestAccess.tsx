"use client";

import { useState } from "react";
import type { PublicTrip, Section } from "@/lib/types";
import styles from "./RequestAccess.module.css";

export interface RequestAccessProps {
  trip: PublicTrip;
  section: Section;
  contactEmail: string | null;
}

// Shown in place of the Add form to a visitor with no invite link (and
// no admin session) — the only way for them to get one is to ask, so
// this builds a mailto: instead of standing up a real backend email
// flow (no new provider, no API key, nothing that can fail to
// deliver silently). The trip owner replies with an invite link
// generated from InviteLinksManager.
export default function RequestAccess({ trip, section, contactEmail }: RequestAccessProps) {
  const [message, setMessage] = useState("");
  const [expanded, setExpanded] = useState(false);

  if (!contactEmail) return null;

  const subject = `Access request: ${trip.name}`;
  const bodyLines = [
    `Hi — I'd like to add to the "${section.label}" list for ${trip.name}.`,
    message.trim(),
    "",
    `Page: ${typeof window !== "undefined" ? window.location.href : ""}`,
  ].filter(Boolean);
  const mailtoHref = `mailto:${contactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(
    bodyLines.join("\n")
  )}`;

  if (!expanded) {
    return (
      <button onClick={() => setExpanded(true)} className={styles.trigger}>
        Want to add something here? Request access
      </button>
    );
  }

  return (
    <div className={styles.card}>
      <p className={styles.intro}>
        This opens your email app with a message to the trip owner asking for an invite link.
      </p>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Anything you want to mention (optional)"
        rows={2}
        className={styles.textarea}
      />
      <div className={styles.actions}>
        <a href={mailtoHref} className={styles.emailButton}>
          Open email to request access
        </a>
        <button type="button" onClick={() => setExpanded(false)} className={styles.cancelButton}>
          Cancel
        </button>
      </div>
    </div>
  );
}
