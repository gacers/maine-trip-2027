"use client";

import { useEffect, useState } from "react";

export default function ApiKeysManager({ trip }) {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [label, setLabel] = useState("");
  const [global, setGlobal] = useState(false);
  const [newToken, setNewToken] = useState(null);
  const [revealed, setRevealed] = useState({}); // { [keyId]: token }
  const apiBase = `/api/trips/${trip.slug}/api-keys`;

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(apiBase, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setKeys(data.apiKeys.filter((k) => k.role !== "contributor"));
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
        body: JSON.stringify({ label: label || undefined, role: "owner", global }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setNewToken(data.token);
      setLabel("");
      setGlobal(false);
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

  async function handleReveal(id) {
    setError("");
    try {
      const res = await fetch(`${apiBase}/${id}/reveal`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRevealed((prev) => ({ ...prev, [id]: data.token }));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-zinc-500">
        Full-access keys — for Claude Desktop or other automation. Can add, edit, delete, and archive. To share a
        limited add-only link with a friend, use Invite Links instead.
      </p>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">{error}</p>}

      {newToken && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 flex flex-col gap-2">
          <p className="text-sm font-medium text-amber-800">
            Save this now, or come back and click &quot;Show&quot; on it later — it&apos;s never emailed or texted
            to you.
          </p>
          <code className="text-xs bg-white border border-amber-200 rounded p-2 break-all select-all">
            {newToken}
          </code>
          <button onClick={() => setNewToken(null)} className="text-xs text-zinc-500 hover:underline self-start">
            Dismiss
          </button>
        </div>
      )}

      <form onSubmit={handleCreate} className="flex flex-col gap-2">
        <div className="flex gap-2">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Label (e.g. Claude Desktop)"
            className="flex-1 rounded border border-zinc-300 px-3 py-2 text-sm"
          />
          <button type="submit" className="rounded bg-zinc-900 text-white px-4 py-2 text-sm font-medium">
            Generate key
          </button>
        </div>
        <label className="flex items-center gap-2 text-sm text-zinc-600">
          <input type="checkbox" checked={global} onChange={(e) => setGlobal(e.target.checked)} />
          Valid for all trips, not just this one — generate this once and reuse it everywhere instead of making a
          new key per trip.
        </label>
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
              className={`rounded-lg border p-3 flex flex-col gap-2 ${
                k.revoked ? "border-zinc-200 bg-zinc-50 opacity-60" : "border-zinc-200 bg-white"
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-zinc-900 text-sm">
                    {k.label}
                    {!k.trip_id && <span className="ml-2 text-xs text-zinc-400 font-normal">(all trips)</span>}
                  </div>
                  <div className="text-xs text-zinc-500">
                    Created {new Date(k.created_at).toLocaleDateString()}
                    {k.last_used_at && ` · last used ${new Date(k.last_used_at).toLocaleDateString()}`}
                    {k.revoked && " · revoked"}
                  </div>
                </div>
                {!k.revoked && (
                  <div className="flex items-center gap-3 shrink-0">
                    {k.hasStoredToken && !revealed[k.id] && (
                      <button onClick={() => handleReveal(k.id)} className="text-sm text-blue-600 hover:underline">
                        Show
                      </button>
                    )}
                    <button onClick={() => handleRevoke(k.id)} className="text-sm text-red-600 hover:underline">
                      Revoke
                    </button>
                  </div>
                )}
              </div>
              {revealed[k.id] && (
                <code className="text-xs bg-zinc-50 border border-zinc-200 rounded p-2 break-all select-all">
                  {revealed[k.id]}
                </code>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
