// Trip-wide reference points that show up on every listing's map,
// regardless of which house it is.
export const ACADIA = {
  lat: 44.4089658,
  lng: -68.2472733,
  label: "Acadia National Park",
  color: "#2E7D32",
};

// Stonington's mail boat (Isle au Haut Boat Services) always shows up —
// it's a fixed trip stop on its own, not just a puffin option.
export const STONINGTON = {
  lat: 44.1552157,
  lng: -68.660962,
  label: "Stonington (mail boat & puffin tour)",
  color: "#8E24AA",
};

// Other real Maine puffin-tour departure points along the coast. Houses
// can be anywhere from Camden to Downeast, so in addition to Stonington
// (always shown), each listing's map also shows whichever of these is
// actually closest to it.
export const OTHER_PUFFIN_TOUR_OPTIONS = [
  {
    lat: 43.8722,
    lng: -69.4873,
    label: "New Harbor (Hardy Boat puffin tour)",
    color: "#F57C00",
  },
  {
    lat: 44.66444,
    lng: -67.23944,
    label: "Cutler (Bold Coast puffin tour)",
    color: "#F57C00",
  },
  {
    lat: 44.392087,
    lng: -68.204052,
    label: "Bar Harbor (Puffin Lighthouse Cruise)",
    color: "#F57C00",
  },
  {
    lat: 43.85056,
    lng: -69.62778,
    label: "Boothbay Harbor (Cap'n Fish's puffin cruise)",
    color: "#F57C00",
  },
];

function distance(a, b) {
  // Straight-line (haversine) distance in miles — plenty good enough for
  // just picking the nearest option; the Directions API still computes
  // the real driving time/distance shown to the user.
  const R = 3958.8;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// The closest OTHER puffin-tour option to a house, excluding Stonington
// (which is always shown separately). Every listing's map ends up with
// two puffin-tour markers: Stonington, plus whichever of these is nearest.
export function closestOtherPuffinTour(house) {
  return OTHER_PUFFIN_TOUR_OPTIONS.reduce((best, opt) =>
    distance(house, opt) < distance(house, best) ? opt : best
  );
}

// Starting point for the Brooklyn -> house driving time. Not drawn on the
// per-listing map (too far to keep a useful local zoom level) but routed
// via the Directions API for a real duration/distance, same as everything
// else.
export const BROOKLYN_ORIGIN = "Brooklyn, NY";

export const HOUSE_COLOR = "#CC0000";
export const TOWN_COLOR = "#1976D2";
