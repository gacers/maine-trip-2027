"use client";

let loadingPromise = null;

// Loads the Google Maps JavaScript API (with the Directions library) at
// most once per page, regardless of how many map components mount.
export function loadGoogleMaps() {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (window.google && window.google.maps) return Promise.resolve(window.google);
  if (loadingPromise) return loadingPromise;

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return Promise.reject(
      new Error("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not set")
    );
  }

  loadingPromise = new Promise((resolve, reject) => {
    const callbackName = "__gmapsInit";
    window[callbackName] = () => {
      resolve(window.google);
      delete window[callbackName];
    };
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=${callbackName}`;
    script.async = true;
    script.onerror = () => reject(new Error("Failed to load Google Maps JS API"));
    document.head.appendChild(script);
  });

  return loadingPromise;
}


// Looks up an address string and returns { lat, lng }, or throws if it
// can't be found. Uses the core Geocoder (no extra library needed beyond
// the base Maps JS API already loaded above).
export async function geocodeAddress(address) {
  const google = await loadGoogleMaps();
  return new Promise((resolve, reject) => {
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ address }, (results, status) => {
      if (status === "OK" && results && results[0]) {
        const loc = results[0].geometry.location;
        resolve({ lat: loc.lat(), lng: loc.lng(), formattedAddress: results[0].formatted_address });
      } else {
        reject(new Error(`Couldn't find that address (${status})`));
      }
    });
  });
}

// Reverse-geocodes a point to the town it's in (Google's "locality" level
// of the result, or the closest equivalent for small unincorporated
// places), used for the "Closest Town" link + driving time on a listing's
// map. Returns the town's own name/center (not the input point), plus a
// "name, state" query string to search for.
export async function reverseGeocodeTown(lat, lng) {
  const google = await loadGoogleMaps();
  return new Promise((resolve, reject) => {
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
      if (status !== "OK" || !results || !results.length) {
        reject(new Error(`Couldn't find a town for this location (${status})`));
        return;
      }
      const townResult = ["locality", "postal_town", "administrative_area_level_3"]
        .map((type) => results.find((r) => r.types.includes(type)))
        .find(Boolean);
      if (!townResult) {
        reject(new Error("Couldn't determine a town name for this location"));
        return;
      }
      const nameComp = townResult.address_components[0];
      const stateComp = townResult.address_components.find((c) =>
        c.types.includes("administrative_area_level_1")
      );
      const loc = townResult.geometry.location;
      resolve({
        name: nameComp.long_name,
        searchQuery: stateComp ? `${nameComp.long_name}, ${stateComp.long_name}` : nameComp.long_name,
        lat: loc.lat(),
        lng: loc.lng(),
      });
    });
  });
}
