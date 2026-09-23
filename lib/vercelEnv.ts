// Pushes a credential rotation straight into this project's own Vercel
// deployment, so recovering from a revoked/disabled Google credential
// (see lib/googleCredentialHealth.ts) doesn't also mean hand-navigating
// Vercel's dashboard to find the right env var and click redeploy.
// Needs its own token (VERCEL_API_TOKEN) — deliberately separate from
// anything else this app holds, since it's the one credential capable
// of changing every other one.

const VERCEL_API_BASE = "https://api.vercel.com";

interface VercelErrorBody {
  error?: { message?: string };
}

function projectId(): string {
  const id = process.env.VERCEL_PROJECT_ID;
  if (!id) throw new Error("VERCEL_PROJECT_ID is not set");
  return id;
}

function authHeaders(): Record<string, string> {
  const token = process.env.VERCEL_API_TOKEN;
  if (!token) throw new Error("VERCEL_API_TOKEN is not set");
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

// VERCEL_TEAM_ID is optional — only needed when this project lives
// under a team rather than a personal account; omitted entirely from
// every request when unset rather than sent empty.
function withTeam(url: URL): URL {
  const teamId = process.env.VERCEL_TEAM_ID;
  if (teamId) url.searchParams.set("teamId", teamId);
  return url;
}

async function vercelFetch<T>(url: URL, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { ...authHeaders(), ...(init?.headers || {}) } });
  const data = (await res.json()) as T & VercelErrorBody;
  if (!res.ok) throw new Error(data.error?.message || `Vercel API request failed (${res.status})`);
  return data;
}

interface VercelEnvVar {
  id: string;
  key: string;
  target?: string[] | string;
}

function targetsProduction(target: VercelEnvVar["target"]): boolean {
  return Array.isArray(target) ? target.includes("production") : target === "production";
}

// Finds `key`'s existing *Production*-targeted env var and overwrites
// its value; creates a new Production-only one if none exists yet
// (confirmed live: at least one credential in this project — the
// OAuth refresh token — is currently set for Development only, not
// Production, so this can't just match by key and assume it's the
// right row; the same key can have a same-named but differently-
// targeted row that patching would silently update instead, leaving
// Production untouched). Returns the env var's id, mostly so a caller
// can log/confirm which row actually changed.
export async function updateEnvVar(key: string, value: string): Promise<{ id: string }> {
  const project = projectId();
  const listUrl = withTeam(new URL(`${VERCEL_API_BASE}/v10/projects/${project}/env`));
  const listData = await vercelFetch<{ envs?: VercelEnvVar[] }>(listUrl);
  const envs = listData.envs || [];
  const existing = envs.find((e) => e.key === key && targetsProduction(e.target));

  if (existing) {
    const patchUrl = withTeam(new URL(`${VERCEL_API_BASE}/v9/projects/${project}/env/${existing.id}`));
    const data = await vercelFetch<{ id: string }>(patchUrl, {
      method: "PATCH",
      body: JSON.stringify({ value }),
    });
    return { id: data.id || existing.id };
  }

  const createUrl = withTeam(new URL(`${VERCEL_API_BASE}/v10/projects/${project}/env`));
  const data = await vercelFetch<{ id: string }>(createUrl, {
    method: "POST",
    body: JSON.stringify({ key, value, type: "encrypted", target: ["production"] }),
  });
  return { id: data.id };
}

interface VercelDeployment {
  uid: string;
  name: string;
  url: string;
}

// A new env var value only takes effect on the *next* deployment — an
// existing running one already has last build's values baked into its
// own Lambda. Finds the latest production deployment and redeploys
// from it (same code, same settings, just re-built so the new env
// value gets picked up), rather than requiring a fresh git push.
export async function triggerRedeploy(): Promise<{ deploymentId: string; url: string }> {
  const project = projectId();
  const listUrl = withTeam(new URL(`${VERCEL_API_BASE}/v7/deployments`));
  listUrl.searchParams.set("projectId", project);
  listUrl.searchParams.set("target", "production");
  listUrl.searchParams.set("limit", "1");
  const listData = await vercelFetch<{ deployments?: VercelDeployment[] }>(listUrl);
  const latest = listData.deployments?.[0];
  if (!latest) throw new Error("No existing production deployment found to redeploy from");

  const createUrl = withTeam(new URL(`${VERCEL_API_BASE}/v13/deployments`));
  const data = await vercelFetch<{ id: string; url: string }>(createUrl, {
    method: "POST",
    body: JSON.stringify({ name: latest.name, deploymentId: latest.uid, target: "production" }),
  });
  return { deploymentId: data.id, url: data.url };
}
