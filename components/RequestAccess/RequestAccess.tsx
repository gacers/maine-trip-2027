"use client";

import { useState, type FormEvent } from "react";
import { Dialog, DialogTrigger, DialogContent, DialogTitle, DialogDescription, DialogClose } from "@/components/Dialog";
import Button, { type ButtonVariant, type ButtonSize } from "@/components/Button";
import type { PublicTrip, Section } from "@/lib/types";
import styles from "./RequestAccess.module.css";

export interface RequestAccessProps {
  trip: PublicTrip;
  /** Omitted by TripAccessGate, which blocks a whole trip before any
   * particular section is even reachable — the request just names the
   * trip generally then. Every other caller (the nav bar) already
   * knows the section the visitor landed on, and mentions it by name. */
  section?: Section;
  contactEmail: string | null;
  /** Extra class for the trigger button — e.g. letting it wrap in a
   * tight space like the nav bar instead of overflowing on one line. */
  triggerClassName?: string;
  /** Defaults match the small nav-bar link this has always been —
   * TripAccessGate passes a bigger/bolder variant since there it's the
   * primary action on the page, not a corner link. */
  triggerVariant?: ButtonVariant;
  triggerSize?: ButtonSize;
}

// Shown in place of the Add form to a visitor with no invite link (and
// no admin session) — emails the trip owner via Resend (see
// /api/.../request-access) asking for an invite. The owner replies
// from their inbox (Reply-To is the requester) or creates an invite in
// InviteLinksManager.
export default function RequestAccess({
  trip,
  section,
  contactEmail,
  triggerClassName,
  triggerVariant = "link",
  triggerSize = "sm",
}: RequestAccessProps) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  if (!contactEmail) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSending(true);
    setError("");
    try {
      const res = await fetch(`/api/trips/${trip.slug}/request-access`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          message: message.trim(),
          sectionLabel: section?.label,
          pageUrl: typeof window !== "undefined" ? window.location.href : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't send request");
      setSent(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setError("");
      setSent(false);
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant={triggerVariant} size={triggerSize} className={triggerClassName}>
          Request access
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Request access</DialogTitle>
        {sent ? (
          <DialogDescription>
            Sent — we&apos;ll email you if you get an invite. You can close this.
          </DialogDescription>
        ) : (
          <>
            <DialogDescription>
              Sends a message to the trip owner asking for an invite link. Include an email we can reply to.
            </DialogDescription>
            <form onSubmit={handleSubmit} className={styles["form"]}>
              <label className={styles["field"]}>
                Your email
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={styles["input"]}
                  autoComplete="email"
                />
              </label>
              <label className={styles["field"]}>
                Message <span className={styles["optional"]}>(optional)</span>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Anything you want to mention"
                  rows={3}
                  className={styles["textarea"]}
                />
              </label>
              {error && <p className={styles["error"]}>{error}</p>}
              <div className={styles["actions"]}>
                <Button type="submit" variant="primary" size="sm" disabled={sending}>
                  {sending ? "Sending..." : "Send request"}
                </Button>
                <DialogClose asChild>
                  <Button type="button" variant="ghost" size="sm">
                    Cancel
                  </Button>
                </DialogClose>
              </div>
            </form>
          </>
        )}
        {sent && (
          <div className={styles["actions"]}>
            <DialogClose asChild>
              <Button variant="primary" size="sm">
                Close
              </Button>
            </DialogClose>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
