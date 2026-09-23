// Shared palette for map reference points (Trip Settings' "Points of
// interest" alwaysShown editor, and the closestOf places-search editor
// alongside it) — cycled by index so each newly-added point gets a
// distinct color from the last.
export const POI_COLORS = ["#2E7D32", "#8E24AA", "#F57C00", "#1976D2", "#C2185B", "#00897B"];

// Same idea for an entry's own "Extra map points" (ExtraMapPointsEditor)
// — a separate palette from POI_COLORS above so a kayak trip's put-in/
// take-out pins don't happen to land on the exact same colors a trip's
// Acadia/puffin-tour reference points already use nearby on the map.
export const MARKER_COLORS = ["#1A73E8", "#EF6C00", "#00897B", "#C2185B", "#5D4037", "#616161"];
