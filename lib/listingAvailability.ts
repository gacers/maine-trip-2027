// Appends check-in/check-out dates to an Airbnb or VRBO listing URL so
// clicking straight through shows real availability for a trip's own
// dates, instead of a bare listing page that still needs the dates
// picked by hand. Every other host (a Google Maps place, a plain
// website, ...) has no known date-param convention, so this just
// returns the url unchanged for those — safe to call unconditionally
// on any entry's own url.
//
// Airbnb's check_in/check_out (YYYY-MM-DD) is well-documented and
// stable. VRBO's startDate/endDate (M/D/YYYY) is the commonly-used
// deep-link format for a listing-with-dates — unlike the rest of this
// app's Airbnb/VRBO handling (lib/scrape.ts), this hasn't been
// confirmed live against a real VRBO listing; verify it actually lands
// on the right dates once used for real; adjust here if it doesn't.
export function withAvailabilityDates(rawUrl: string, start: string, end: string): string {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    return rawUrl;
  }
  const host = u.hostname.replace(/^www\./, "");

  if (host.includes("airbnb.")) {
    u.searchParams.set("check_in", start);
    u.searchParams.set("check_out", end);
    return u.toString();
  }

  if (host.includes("vrbo.") || host.includes("homeaway.")) {
    const toVrboDate = (iso: string) => {
      const [y, m, d] = iso.split("-");
      return `${m}/${d}/${y}`;
    };
    u.searchParams.set("startDate", toVrboDate(start));
    u.searchParams.set("endDate", toVrboDate(end));
    return u.toString();
  }

  return rawUrl;
}

export function isKnownBookingHost(rawUrl: string): boolean {
  try {
    const host = new URL(rawUrl).hostname.replace(/^www\./, "");
    return host.includes("airbnb.") || host.includes("vrbo.") || host.includes("homeaway.");
  } catch {
    return false;
  }
}
