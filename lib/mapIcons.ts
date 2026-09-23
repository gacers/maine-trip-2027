import type { GoogleMapsApi } from "@/lib/useGoogleMaps";

// A colored map-pin icon (teardrop shape, white outline + center dot) —
// shared by every map that plots more than one kind of point in
// different colors (ListingMap's own reference points/closest town,
// SimplePlaceMap's "Extra map points") so a spot worth visiting reads
// as an actual pin, not a flat dot, everywhere on the site. The
// entry/house's own marker keeps its distinct star icon (see
// ListingMap's starIcon) — this is just for everything plotted
// alongside it.
export function pinIcon(google: GoogleMapsApi, color: string) {
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="40" viewBox="0 0 28 40">' +
    '<path d="M14 0C6.3 0 0 6.3 0 14c0 10.5 14 26 14 26s14-15.5 14-26C28 6.3 21.7 0 14 0z" ' +
    `fill="${color}" stroke="#ffffff" stroke-width="1.5"/>` +
    '<circle cx="14" cy="14" r="5" fill="#ffffff"/></svg>';
  return {
    url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg),
    scaledSize: new google.maps.Size(28, 40),
    anchor: new google.maps.Point(14, 40),
    // Centers a marker's own `label` (ListingMap's lettered A/B/C
    // destinations) in the pin's round head instead of at its bottom
    // tip, which is where a Marker's label sits by default (relative to
    // `anchor`).
    labelOrigin: new google.maps.Point(14, 14),
  };
}
