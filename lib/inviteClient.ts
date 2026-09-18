"use client";

// Persists an invite-link token (see InviteLinksManager) in the
// visitor's own browser, keyed per trip — so a friend who follows
// `/{tripSlug}?invite=<token>` once stays recognized on later visits
// without the param, and different trips' invites never collide.
// localStorage is a per-viewer convenience here, not shared state:
// each friend's own browser remembers their own invite.
function storageKey(tripSlug: string): string {
  return `invite:${tripSlug}`;
}

function emailStorageKey(tripSlug: string): string {
  return `invite-email:${tripSlug}`;
}

export function readInviteToken(tripSlug: string): string | null {
  try {
    return window.localStorage.getItem(storageKey(tripSlug)) || null;
  } catch {
    return null;
  }
}

function writeInviteToken(tripSlug: string, token: string): void {
  try {
    window.localStorage.setItem(storageKey(tripSlug), token);
  } catch {
    // Private window / blocked storage — the token still works for this
    // page load via the state it was captured into, just won't persist.
  }
}

export function readInviteEmail(tripSlug: string): string | null {
  try {
    return window.localStorage.getItem(emailStorageKey(tripSlug)) || null;
  } catch {
    return null;
  }
}

function writeInviteEmail(tripSlug: string, email: string): void {
  try {
    window.localStorage.setItem(emailStorageKey(tripSlug), email);
  } catch {
    // Same private-window caveat as the invite token.
  }
}

// Drop this trip's browser invite after they upgrade to a permanent
// login (create or claim-editor). Otherwise Logout leaves the invite
// token in place and they can still edit — which feels like logout
// didn't work. Invite email prefill goes too; nudge flag can stay.
export function clearInviteAccess(tripSlug: string): void {
  try {
    window.localStorage.removeItem(storageKey(tripSlug));
    window.localStorage.removeItem(emailStorageKey(tripSlug));
  } catch {
    // Private window / blocked storage — nothing to clear.
  }
}

// Slugs this browser has a stored invite token for — used by the All
// Trips index to show only trips an anonymous contributor can open.
export function listInviteTripSlugs(): string[] {
  try {
    const slugs: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith("invite:") && !key.startsWith("invite-email:")) {
        const slug = key.slice("invite:".length);
        if (slug && window.localStorage.getItem(key)) slugs.push(slug);
      }
    }
    return slugs;
  } catch {
    return [];
  }
}

// Call once on mount from a trip page. If the URL carries `?invite=...`,
// stores it and strips the param (so it doesn't linger in the address
// bar or get shared onward by accident) via history.replaceState — no
// navigation, no re-render loop. Optional `?email=` (from a direct
// invite link) is stored the same way for CreateLoginPrompt prefill.
// Returns the effective token: the freshly-captured one, or whatever
// was already stored for this trip.
export function captureInviteToken(tripSlug: string): string | null {
  const url = new URL(window.location.href);
  const fromUrl = url.searchParams.get("invite");
  const emailFromUrl = url.searchParams.get("email");
  let stripped = false;

  if (fromUrl) {
    writeInviteToken(tripSlug, fromUrl);
    url.searchParams.delete("invite");
    stripped = true;
  }
  if (emailFromUrl) {
    writeInviteEmail(tripSlug, emailFromUrl.trim());
    url.searchParams.delete("email");
    stripped = true;
  }
  if (stripped) {
    window.history.replaceState({}, "", url.pathname + url.search + url.hash);
  }
  return fromUrl || readInviteToken(tripSlug);
}

// The invite token is really just a gate to see features (Add form,
// rating) — it's not a person. Two different people sharing one link
// would otherwise be counted as the same rater, since the token is
// their only credential. This is a separate, randomly-generated id, not
// tied to any trip or invite link, persisted once per browser — see
// lib/ratings.ts's resolveRaterKey, which uses it (not the token) as a
// contributor's actual identity for scoring. An admin's real login
// already has a stable identity of its own and never needs this.
const DEVICE_ID_KEY = "rater-device-id";

// Whether this browser has already been shown the "you can create a
// permanent login" nudge for this trip — checked once, right after a
// contributor's first real visit via an invite link, so the offer to
// create a permanent login (see CreateLoginPrompt) is actually
// surfaced up front instead of sitting as an easy-to-miss small link
// they'd only find by noticing it. Shown at most once per browser per
// trip; the small link itself never goes away, so they can still open
// it deliberately later even after dismissing the nudge.
const CREATE_LOGIN_NUDGE_KEY_PREFIX = "create-login-nudge-seen:";

export function hasSeenCreateLoginNudge(tripSlug: string): boolean {
  try {
    return window.localStorage.getItem(CREATE_LOGIN_NUDGE_KEY_PREFIX + tripSlug) === "1";
  } catch {
    return false;
  }
}

export function markCreateLoginNudgeSeen(tripSlug: string): void {
  try {
    window.localStorage.setItem(CREATE_LOGIN_NUDGE_KEY_PREFIX + tripSlug, "1");
  } catch {
    // Private window / blocked storage — the nudge just shows again
    // next visit instead of staying dismissed; harmless either way.
  }
}

export function getOrCreateDeviceId(): string {
  try {
    let id = window.localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      window.localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    // Private window / blocked storage — still works for this page load,
    // just won't be recognized as "mine" again on the next visit.
    return crypto.randomUUID();
  }
}
