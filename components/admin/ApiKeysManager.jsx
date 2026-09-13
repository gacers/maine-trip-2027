"use client";

import { useEffect, useState } from "react";

export default function ApiKeysManager({ trip }) {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [label, setLabel] = useState("");
  const [newToken, setNewToken] = useState(null);
  const apiBase = `/api/trips/${trip.slug}/api-keys`;

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(apiBase, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setKeys(data.apiKeys);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBase]);

  async function handleCreate(e) {
    e.preventDefault();
    setError("");
    try {
      const res = await fetch(apiBase, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: label || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setNewToken(data.token);
      setLabel("");
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleRevoke(id) {
    try {
      const res = await fetch(`${apiBase}/${id}`, { method: "PATCH" });
      if (!res.ok) throw new Error("Revoke failed");
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">{error}</p>}

      {newToken && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 flex flex-col gap-2">
          <p className="text-sm font-medium text-amber-800">
            Save this now — it&apos;s shown only once and can&apos;t be recovered later.
          </p>
          <code className="text-xs bg-white border border-amber-200 rounded p-2 break-all select-all">
            {newToken}
          </code>
          <button onClick={() => setNewToken(null)} className="text-xs text-zinc-500 hover:underline self-start">
            Dismiss
          </button>
        </div>
      )}

      <form onSubmit={handleCreate} className="flex gap-2">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Label (e.g. Claude Desktop)"
          className="flex-1 rounded border border-zinc-300 px-3 py-2 text-sm"
        />
        <button type="submit" className="rounded bg-zinc-900 text-white px-4 py-2 text-sm font-medium">
          Generate key
        </button>
      </form>

      {loading ? (
        <p className="text-sm text-zinc-500">Loading...</p>
      ) : keys.length === 0 ? (
        <p className="text-sm text-zinc-500">No keys yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {keys.map((k) => (
            <div
              key={k.id}
              className={`rounded-lg border p-3 flex items-center justify-between ${
                k.revoked ? "border-zinc-200 bg-zinc-50 opacity-60" : "border-zinc-200 bg-white"
              }`}
            >
              <div>
                <div className="font-medium text-zinc-900 text-sm">{k.label}</div>
                <div className="text-xs text-zinc-500">
                  Created {new Date(k.created_at).toLocaleDateString()}
                  {k.last_used_at && ` · last used ${new Date(k.last_used_at).toLocaleDateString()}`}
                  {k.revoked && " · revoked"}
                </div>
              </div>
              {!k.revoked && (
                <button onClick={() => handleRevoke(k.id)} className="text-sm text-red-600 hover:underline">
                  Revoke
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
