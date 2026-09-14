"use client";

import { useState } from "react";
import { Dialog, DialogTrigger, DialogContent, DialogTitle, DialogDescription, DialogClose } from "@/components/Dialog";
import Button from "@/components/Button";
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
// generated from InviteLinksManager. The actual form lives in a modal
// (Radix Dialog) rather than expanding inline — this trigger shows up
// in tight spaces (the nav bar) where growing in place isn't an option.
export default function RequestAccess({ trip, section, contactEmail }: RequestAccessProps) {
  const [message, setMessage] = useState("");
  const [open, setOpen] = useState(false);

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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="link" size="sm">
          Want to add something here? Request access
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Request access</DialogTitle>
        <DialogDescription>This opens your email app with a message to the trip owner asking for an invite link.</DialogDescription>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Anything you want to mention (optional)"
          rows={3}
          className={styles.textarea}
        />
        <div className={styles.actions}>
          <Button variant="primary" size="sm" asChild>
            <a href={mailtoHref}>Open email to request access</a>
          </Button>
          <DialogClose asChild>
            <Button variant="ghost" size="sm">
              Cancel
            </Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}
