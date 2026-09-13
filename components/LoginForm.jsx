"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetting, setResetting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const supabase = supabaseBrowser();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    router.push(next);
    router.refresh();
  }

  // Uses the SDK's own resetPasswordForEmail (rather than a raw REST
  // call) so redirectTo is set correctly, and window.location.origin so
  // it works from whichever domain you're actually on (custom domain or
  // the vercel.app one) without hardcoding either.
  async function handleForgotPassword() {
    if (!email.trim()) {
      setError("Enter your email above first, then click \"Forgot password\".");
      return;
    }
    setResetting(true);
    setError("");
    const supabase = supabaseBrowser();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setResetting(false);
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setResetSent(true);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        Email
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded border border-zinc-300 px-2 py-1.5"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Password
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded border border-zinc-300 px-2 py-1.5"
        />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {resetSent && (
        <p className="text-sm text-green-700">
          If that email has an account, a reset link was just sent to it.
        </p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="rounded bg-zinc-900 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
      >
        {loading ? "Signing in..." : "Sign in"}
      </button>
      <button
        type="button"
        onClick={handleForgotPassword}
        disabled={resetting}
        className="text-sm text-zinc-500 hover:underline self-center disabled:opacity-50"
      >
        {resetting ? "Sending..." : "Forgot password?"}
      </button>
    </form>
  );
}
