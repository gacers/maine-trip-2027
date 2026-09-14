// Ambient typing for CSS Module imports (`import styles from "./X.module.css"`)
// — TypeScript has no built-in knowledge of what a .css import resolves to.
declare module "*.module.css" {
  const classes: { readonly [className: string]: string };
  export default classes;
}

// The Google Maps JS API attaches itself to `window.google` once loaded
// (see lib/loadGoogleMaps.ts) — no @types/google.maps package installed,
// so this stays untyped (see lib/useGoogleMaps.ts's GoogleMapsApi) rather
// than typing Google's entire API surface.
interface Window {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  google?: any;
  [key: string]: unknown;
}
