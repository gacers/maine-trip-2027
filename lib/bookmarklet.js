// The actual different approach: instead of our server (or a paid
// third-party service) re-fetching a listing page from the outside —
// the thing that's been proven unreliable against Airbnb's harder
// defenses no matter which of four independent tools tried it — this
// runs *inside the visitor's own browser tab*, on the real page
// they're already successfully looking at. It reads title/description/
// photo/coordinates straight out of that page's own DOM (JSON-LD first,
// then OpenGraph tags — the same priority lib/scrape.js already uses
// server-side) and opens this trip's Add form with them pre-filled.
// Nothing is fetched from anywhere else, so there is nothing to block:
// if a visitor's own browser can see the page, this can read it.
//
// `destinationUrl` should already carry an invite token in its query
// string if whoever's installing this isn't a signed-in admin — see
// components/BookmarkletButton.jsx.
export function buildBookmarkletHref(destinationUrl) {
  function extractAndOpen(dest) {
    try {
      var LISTING_TYPES = [
        "VacationRental",
        "LodgingBusiness",
        "House",
        "Apartment",
        "Product",
        "Restaurant",
        "LocalBusiness",
        "BarOrPub",
        "CafeOrCoffeeShop",
        "TouristAttraction",
      ];
      var jsonLd = null;
      var scripts = document.querySelectorAll('script[type="application/ld+json"]');
      for (var i = 0; i < scripts.length; i++) {
        try {
          var parsed = JSON.parse(scripts[i].textContent);
          var items = Array.isArray(parsed) ? parsed : [parsed];
          for (var j = 0; j < items.length; j++) {
            if (items[j] && LISTING_TYPES.indexOf(items[j]["@type"]) !== -1) {
              jsonLd = items[j];
              break;
            }
          }
        } catch (e) {
          /* malformed block, try the next one */
        }
        if (jsonLd) break;
      }

      function meta(prop) {
        var el =
          document.querySelector('meta[property="' + prop + '"]') ||
          document.querySelector('meta[name="' + prop + '"]');
        return el ? el.getAttribute("content") : null;
      }

      var title = (jsonLd && jsonLd.name) || meta("og:title") || document.title || "";
      var description = (jsonLd && jsonLd.description) || meta("og:description") || "";
      var rawImage = jsonLd && jsonLd.image;
      var image = (Array.isArray(rawImage) ? rawImage[0] : rawImage) || meta("og:image") || "";
      var geo = jsonLd && jsonLd.geo;
      var lat = (jsonLd && jsonLd.latitude) ?? (geo && geo.latitude);
      var lng = (jsonLd && jsonLd.longitude) ?? (geo && geo.longitude);

      var params = new URLSearchParams();
      params.set("bm", "1");
      params.set("url", location.href.split("?")[0]);
      if (title) params.set("title", String(title).slice(0, 200));
      if (description) params.set("description", String(description).slice(0, 1200));
      if (image) params.set("image", image);
      if (lat != null) params.set("lat", lat);
      if (lng != null) params.set("lng", lng);

      window.open(dest + (dest.indexOf("?") === -1 ? "?" : "&") + params.toString(), "_blank");
    } catch (e) {
      alert("Couldn't read this page — open the Add form and fill it in manually instead.");
    }
  }

  const body = extractAndOpen.toString();
  return `javascript:(${body})(${JSON.stringify(destinationUrl)});`;
}
