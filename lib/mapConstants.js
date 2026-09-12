// Trip-wide reference points that show up on every listing's map,
// regardless of which house it is.
export const ACADIA = {
  lat: 44.4089658,
  lng: -68.2472733,
  label: "Acadia National Park",
  color: "#2E7D32",
};

export const STONINGTON_MAILBOAT = {
  lat: 44.1552157,
  lng: -68.660962,
  label: "Stonington mail boat (puffin tours)",
  color: "#8E24AA",
};

export const FIXED_DESTINATIONS = [ACADIA, STONINGTON_MAILBOAT];

// Starting point for the Brooklyn -> house driving time. Not drawn on the
// per-listing map (too far to keep a useful local zoom level) but routed
// via the Directions API for a real duration/distance, same as everything
// else.
export const BROOKLYN_ORIGIN = "Brooklyn, NY";

export const HOUSE_COLOR = "#CC0000";
