// Briefly highlights the element with this id — a plain global CSS
// class (see app/globals.css's .pin-jump-highlight), not a CSS Module
// one, since the target could be in any component (EntryCard's own
// #listing-<id>, or ListingSection's #group-<id> for a paired option).
// Shared by OverviewMap's own pin-click jump and SectionPage's "landed
// here via a direct link to one specific item" case (a Sheet's own
// HYPERLINK, or any other external link carrying a #listing-<id>/
// #group-<id> fragment) — both are the same "make it obvious which one
// you actually landed on" need. Returns whether an element was found
// at all, so a caller can skip updating the URL/state for a hash that
// doesn't match anything on this page.
export function flashAnchor(
  id: string,
  options: { scroll?: boolean; flash?: boolean } = {}
): boolean {
  if (typeof document === "undefined") return false;
  const el = document.getElementById(id);
  if (!el) return false;

  // Defaults: no scroll unless asked; flash unless explicitly turned off
  // (OverviewMap pin clicks omit both and get flash-only via their own
  // scrollIntoView first — SectionPage passes scroll/flash explicitly).
  if (options.scroll) {
    // scroll-margin-top on the card/group itself (see EntryCard's and
    // ListingSection's own CSS) keeps this from landing half behind
    // TripNavHeader's sticky bar.
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (options.flash === false) return true;

  el.classList.remove("pin-jump-highlight");
  // Force a reflow so re-adding the class restarts the animation even
  // if the same element is flashed again mid-pulse.
  void el.offsetWidth;
  el.classList.add("pin-jump-highlight");
  window.setTimeout(() => el.classList.remove("pin-jump-highlight"), 5000);
  return true;
}
