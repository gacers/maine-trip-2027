"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

// Lands here from a Supabase "recover" (magic-link-style) email. The
// browser client auto-detects the recovery token in the URL and
// establishes a temporary session — updateUser({password}) then sets
// the real one.
export default function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const supabase = supabaseBrowser();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setSuccess(true);
    setTimeout(() => router.push("/"), 1500);
  }

  if (success) {
    return <p className="text-sm text-green-700 text-center">Password set — redirecting...</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        New password
        <input
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded border border-zinc-300 px-2 py-1.5"
        />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="rounded bg-zinc-900 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
      >
        {loading ? "Saving..." : "Set password"}
      </button>
    </form>
  );
}
