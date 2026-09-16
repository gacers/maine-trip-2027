"use client";

import { useState, type FormEvent } from "react";
import { Dialog, DialogTrigger, DialogContent, DialogTitle, DialogDescription } from "@/components/Dialog";
import Button from "@/components/Button";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import type { PublicTrip } from "@/lib/types";
import styles from "./CreateLoginPrompt.module.css";

export interface CreateLoginPromptProps {
  trip: PublicTrip;
  /** The invite token already captured for this trip in this browser
   * (see lib/inviteClient.ts) — proof this account should actually be
   * linked here, sent once to /become-editor right after signup. */
  contributorToken: string;
}

// Offered to a contributor who's only recognized by this one browser's
// invite token — a real login does the same thing (add/edit/archive,
// same as today) but follows them across devices, and survives a
// private/incognito window a token never does. Purely optional: the
// existing link keeps working exactly as it always has either way.
export default function CreateLoginPrompt({ trip, contributorToken }: CreateLoginPromptProps) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      // Creates the account server-side (this project has public
      // sign-up disabled — see the route's own comment) and links it
      // to this trip in one step, gated on the invite token proving
      // this browser genuinely had access already.
      const res = await fetch(`/api/trips/${trip.slug}/become-editor`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${contributorToken}` },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't create a login");

      // The account exists now, but creating it server-side doesn't
      // hand this browser a session — a normal sign-in does, and isn't
      // subject to the disabled-signup setting (that only blocks new
      // accounts, not signing in with valid credentials).
      const { error: signInError } = await supabaseBrowser().auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;

      setDone(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="link" size="sm">
          Create a permanent login
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Create a permanent login</DialogTitle>
        {done ? (
          <DialogDescription>
            Done — sign in with {email} on any device from now on for the same access.
          </DialogDescription>
        ) : (
          <>
            <DialogDescription>
              Your invite link only works in this browser. A login works anywhere, and can&apos;t be lost in a
              private/incognito window.
            </DialogDescription>
            <form onSubmit={handleSubmit} className={styles["form"]}>
              <label className={styles["field"]}>
                Email
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={styles["input"]}
                />
              </label>
              <label className={styles["field"]}>
                Password
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={styles["input"]}
                />
              </label>
              {error && <p className={styles["error"]}>{error}</p>}
              <Button type="submit" variant="primary" size="sm" disabled={saving} className={styles["submit-button"]}>
                {saving ? "Creating..." : "Create login"}
              </Button>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
