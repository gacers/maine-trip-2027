// Fixed, high-contrast palette assigned by a render unit's position in
// the list — same order SectionPage builds OverviewMap's pins in, so
// "3rd item in the list" and "3rd marker on the map" always land on
// the same color. Cycles once there are more units than colors (same
// limitation Google's own numbered-pin overlays have); a repeated
// color on a long list is a minor loss, not a broken pairing, since
// it's still consistent between that one item and its one marker.
const PIN_COLORS = [
  "#e11d48", // rose
  "#2563eb", // blue
  "#16a34a", // green
  "#d97706", // amber
  "#7c3aed", // violet
  "#0891b2", // cyan
  "#db2777", // pink
  "#65a30d", // lime
];

export function colorForPinIndex(index: number): string {
  return PIN_COLORS[index % PIN_COLORS.length];
}
