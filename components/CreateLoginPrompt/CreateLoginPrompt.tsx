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

type Step = "choice" | "create" | "login" | "done";

// Offered to a contributor who's only recognized by this one browser's
// invite token. First visit opens a soft choice screen (continue /
// create login / sign in) rather than dumping them straight into a
// signup form — that felt confusing when the email already had an
// account ("already registered"). Creating a login is still optional:
// the invite keeps working in this browser either way.
export default function CreateLoginPrompt({ trip, contributorToken, defaultOpen = false }: CreateLoginPromptProps) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);
  const [step, setStep] = useState<Step>("choice");
  const [email, setEmail] = useState(() => readInviteEmail(trip.slug) || "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function dismissNudge() {
    markCreateLoginNudgeSeen(trip.slug);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      dismissNudge();
      setError("");
      setPassword("");
      setStep("choice");
    }
  }

  function goTo(next: Step) {
    setError("");
    setPassword("");
    setStep(next);
  }

  async function handleCreate(e: FormEvent) {
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
      if (!res.ok) {
        const message = data.error || "Couldn't create a login";
        // Already have an account — send them to sign-in instead of
        // leaving them stuck on a create form that can never succeed.
        if (/already been registered/i.test(message)) {
          setError("That email already has a login — sign in instead.");
          setPassword("");
          setStep("login");
          return;
        }
        throw new Error(message);
      }

      // The account exists now, but creating it server-side doesn't
      // hand this browser a session — a normal sign-in does, and isn't
      // subject to the disabled-signup setting (that only blocks new
      // accounts, not signing in with valid credentials).
      const { error: signInError } = await supabaseBrowser().auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;

      dismissNudge();
      setStep("done");
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

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const { error: signInError } = await supabaseBrowser().auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      dismissNudge();
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const title =
    step === "done"
      ? "You're set"
      : step === "login"
        ? "Sign in"
        : step === "create"
          ? "Create a permanent login"
          : "You're in";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="link" size="sm" onClick={() => goTo("choice")}>
          Create a permanent login
        </Button>
      </DialogTrigger>
      <DialogContent className={styles["dialog"]}>
        <DialogClose asChild>
          <Button variant="ghost" size="sm" aria-label="Close" className={styles["close-button"]}>
            <X size={18} />
          </Button>
        </DialogClose>
        <DialogTitle>{title}</DialogTitle>

        {step === "done" && (
          <DialogDescription>
            Done — sign in with {email} on any device from now on for the same access.
          </DialogDescription>
        )}

        {step === "choice" && (
          <>
            <DialogDescription>
              <p>Your invite works in this browser — nothing else is required.</p>
              
             <p>Want access on other devices or browsers?</p>

              <p>Create a permanent login if you don&apos;t have one yet, or sign in if you already do.</p>

              <p>Close modal if you don not want to create a login. You'll still have access to this trip in this specific browser.</p>
            </DialogDescription>
            <div className={styles["choice-actions"]}>
              <Button type="button" variant="primary" size="sm" onClick={() => goTo("create")}>
                Create permanent login
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={() => goTo("login")}>
                Sign in
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  dismissNudge();
                  setOpen(false);
                }}
              >
                Continue for now
              </Button>
            </div>
          </>
        )}

        {step === "create" && (
          <>
            <DialogDescription>
              A login works on any browser and device. Your invite keeps working in this browser either way — you can
              close this if you&apos;d rather wait.
            </DialogDescription>
            <form onSubmit={handleCreate} className={styles["form"]}>
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
              <div className={styles["form-actions"]}>
                <Button type="submit" variant="primary" size="sm" disabled={saving}>
                  {saving ? "Creating..." : "Create login"}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => goTo("choice")}>
                  Back
                </Button>
              </div>
            </form>
          </>
        )}

        {step === "login" && (
          <>
            <DialogDescription>
              Sign in with an existing permanent login. You already have invite access on this browser — this just
              attaches your account here too.
            </DialogDescription>
            <form onSubmit={handleLogin} className={styles["form"]}>
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
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={styles["input"]}
                />
              </label>
              {error && <p className={styles["error"]}>{error}</p>}
              <div className={styles["form-actions"]}>
                <Button type="submit" variant="primary" size="sm" disabled={saving}>
                  {saving ? "Signing in..." : "Sign in"}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => goTo("choice")}>
                  Back
                </Button>
              </div>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
