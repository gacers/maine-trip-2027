"use client";

// Persists an invite-link token (see InviteLinksManager) in the
// visitor's own browser, keyed per trip — so a friend who follows
// `/{tripSlug}?invite=<token>` once stays recognized on later visits
// without the param, and different trips' invites never collide.
// localStorage is a per-viewer convenience here, not shared state:
// each friend's own browser remembers their own invite.
function storageKey(tripSlug) {
  return `invite:${tripSlug}`;
}

export function readInviteToken(tripSlug) {
  try {
    return window.localStorage.getItem(storageKey(tripSlug)) || null;
  } catch {
    return null;
  }
}

function writeInviteToken(tripSlug, token) {
  try {
    window.localStorage.setItem(storageKey(tripSlug), token);
  } catch {
    // Private window / blocked storage — the token still works for this
    // page load via the state it was captured into, just won't persist.
  }
}

// Call once on mount from a trip page. If the URL carries `?invite=...`,
// stores it and strips the param (so it doesn't linger in the address
// bar or get shared onward by accident) via history.replaceState — no
// navigation, no re-render loop. Returns the effective token: the
// freshly-captured one, or whatever was already stored for this trip.
export function captureInviteToken(tripSlug) {
  const url = new URL(window.location.href);
  const fromUrl = url.searchParams.get("invite");
  if (fromUrl) {
    writeInviteToken(tripSlug, fromUrl);
    url.searchParams.delete("invite");
    window.history.replaceState({}, "", url.pathname + url.search + url.hash);
    return fromUrl;
  }
  return readInviteToken(tripSlug);
}

// Call once on mount alongside captureInviteToken. If the URL carries
// the bookmarklet's params (?bm=1&url=...&title=...&description=...
// &image=...&lat=...&lng=...) — see lib/bookmarklet.js for how they get
// there — returns them as one object and strips them from the URL. Not
// persisted anywhere; a one-shot value for this exact page load.
export function captureBookmarkletData() {
  const url = new URL(window.location.href);
  if (url.searchParams.get("bm") !== "1") return null;

  const lat = url.searchParams.get("lat");
  const lng = url.searchParams.get("lng");
  const data = {
    url: url.searchParams.get("url") || "",
    title: url.searchParams.get("title") || "",
    description: url.searchParams.get("description") || "",
    posterImage: url.searchParams.get("image") || "",
    lat: lat ? parseFloat(lat) : null,
    lng: lng ? parseFloat(lng) : null,
  };

  ["bm", "url", "title", "description", "image", "lat", "lng"].forEach((k) => url.searchParams.delete(k));
  window.history.replaceState({}, "", url.pathname + url.search + url.hash);
  return data;
}
