import type { TravelMode, ItineraryTravelMode } from "@/lib/types";

export const ITINERARY_TRAVEL_MODE_LABELS: Record<ItineraryTravelMode, string> = {
  driving: "Driving",
  car_service: "Car service (Uber/taxi)",
  walking: "Walking",
  transit: "Transit",
  bicycling: "Bicycling",
};

// What actually shows on the connector text/icon — "drive" for a car
// service too, since that's genuinely what it is; the label above is
// only for the picker itself, where the distinction is worth calling
// out (booking a car service is a different decision than driving
// yourself, even though the leg itself computes identically).
export const ITINERARY_TRAVEL_MODE_CONNECTOR_LABEL: Record<ItineraryTravelMode, string> = {
  driving: "drive",
  car_service: "car service",
  walking: "walk",
  transit: "transit",
  bicycling: "bike",
};

// Google's Directions API has no "rideshare" mode — a car service
// drives the same roads a regular car would, so this is what every
// actual route lookup for a car_service leg uses underneath.
export function toGoogleTravelMode(mode: ItineraryTravelMode): TravelMode {
  return mode === "car_service" ? "driving" : mode;
}
