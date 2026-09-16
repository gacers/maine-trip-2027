"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Dialog, DialogTrigger, DialogContent, DialogTitle, DialogDescription } from "@/components/Dialog";
import Button from "@/components/Button";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import styles from "./LoginPrompt.module.css";

export interface LoginPromptProps {
  /** Set when this browser already has invite-based access to this
   * trip (see lib/inviteClient.ts) — someone in that state doesn't
   * *need* to log in to keep contributing here, so this shows a heads-
   * up instead of just silently accepting credentials, in case they
   * only clicked Login by habit rather than actually wanting a
   * permanent account on this browser too. */
  hasInviteAccess?: boolean;
  /** Extra class for the trigger button — matches RequestAccess's own
   * prop for the same reason (wrapping in a tight nav-bar space). */
  triggerClassName?: string;
}

// A plain sign-in, for someone who already has a permanent login (see
// CreateLoginPrompt) but this particular browser doesn't recognize —
// shown alongside Request access/Create a permanent login rather than
// only reachable via the separate full-page /login route, since
// dropping out to a whole new page for a two-field form is more
// friction than this deserves. Success just refreshes in place — the
// trip's own layout re-checks isEditor/isAdmin server-side on every
// request, so the header updates to Logout on its own once the cookie
// is set, no separate "you're in now" step needed.
export default function LoginPrompt({ hasInviteAccess, triggerClassName }: LoginPromptProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error: signInError } = await supabaseBrowser().auth.signInWithPassword({ email, password });
    setLoading(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="link" size="sm" className={triggerClassName}>
          Login
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Sign in</DialogTitle>
        {hasInviteAccess && (
          <DialogDescription>
            You already have edit access on this browser via an invite link — you don&apos;t need to log in unless
            you&apos;d rather use a permanent account here instead.
          </DialogDescription>
        )}
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
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={styles["input"]}
            />
          </label>
          {error && <p className={styles["error"]}>{error}</p>}
          <div className={styles["actions"]}>
            <Button type="submit" variant="primary" size="sm" disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/login">Forgot password?</Link>
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
