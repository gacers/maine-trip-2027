"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Dialog, DialogTrigger, DialogContent, DialogTitle, DialogDescription, DialogClose } from "@/components/Dialog";
import Button from "@/components/Button";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { getOrCreateDeviceId, readInviteEmail, markCreateLoginNudgeSeen } from "@/lib/inviteClient";
import type { PublicTrip } from "@/lib/types";
import styles from "./CreateLoginPrompt.module.css";

export interface CreateLoginPromptProps {
  trip: PublicTrip;
  /** The invite token already captured for this trip in this browser
   * (see lib/inviteClient.ts) — proof this account should actually be
   * linked here, sent once to /become-editor right after signup. */
  contributorToken: string;
  /** Open this dialog immediately on mount — used for the one-time
   * "you can make this permanent" nudge on a contributor's first real
   * visit (see TripNavHeader + lib/inviteClient.ts's
   * hasSeenCreateLoginNudge). Only affects the very first render;
   * changing it later has no effect, same as any other initial-state
   * seed. */
  defaultOpen?: boolean;
}

// Offered to a contributor who's only recognized by this one browser's
// invite token — a real login does the same thing (add/edit/archive,
// same as today) but follows them across devices, and survives a
// private/incognito window a token never does. Purely optional: the
// existing link keeps working exactly as it always has either way.
export default function CreateLoginPrompt({ trip, contributorToken, defaultOpen = false }: CreateLoginPromptProps) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);
  const [email, setEmail] = useState(() => readInviteEmail(trip.slug) || "");
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
      // deviceId lets the route bring this browser's own ratings (left
      // as a contributor, keyed by that same id — see lib/ratings.ts's
      // resolveRaterKey) over onto the new account, rather than the
      // account starting with every "My Score" blank.
      const res = await fetch(`/api/trips/${trip.slug}/become-editor`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${contributorToken}` },
        body: JSON.stringify({ email, password, deviceId: getOrCreateDeviceId() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't create a login");

      // The account exists now, but creating it server-side doesn't
      // hand this browser a session — a normal sign-in does, and isn't
      // subject to the disabled-signup setting (that only blocks new
      // accounts, not signing in with valid credentials).
      const { error: signInError } = await supabaseBrowser().auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;

      // So a later logout (invite token still in localStorage) doesn't
      // auto-reopen this nudge — same flag the first-visit effect sets.
      markCreateLoginNudgeSeen(trip.slug);
      setDone(true);
      // The layout above this (TripNavHeader's own parent) re-checks
      // isEditor server-side on every request — without this, the nav
      // bar kept showing "Create a permanent login" until some
      // unrelated navigation happened to trigger a refresh, even though
      // the sign-in above already succeeded and set the session cookie.
      router.refresh();
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
      <DialogContent className={styles["dialog"]}>
        <DialogClose asChild>
          <Button variant="ghost" size="sm" aria-label="Close" className={styles["close-button"]}>
            <X size={18} />
          </Button>
        </DialogClose>
        <DialogTitle>Create a permanent login</DialogTitle>
        {done ? (
          <DialogDescription>
            Done — sign in with {email} on any device from now on for the same access.
          </DialogDescription>
        ) : (
          <>
            <DialogDescription>
              A permanent login is not required, but your invite link only works in this browser. A login works on
              any browser and device if you wish to use the app on multiple devices. I suggest bookmarking the site
              if you don&apos;t create one.
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
