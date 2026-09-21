import type { NextConfig } from "next";
import { createHash } from "crypto";

// `webpack` itself isn't a direct dependency (Next bundles its own copy
// internally) so its types aren't resolvable here — a minimal local
// shape of just the bits this file actually touches.
interface WebpackRule {
  oneOf?: WebpackRule[];
  rules?: WebpackRule[];
  use?: WebpackUseItem | WebpackUseItem[];
}
interface WebpackUseItem {
  loader?: string;
  options?: { modules?: Record<string, unknown> };
}

// Next's own CSS Modules class names look like `Foo_bar__ab3de` (see
// next/dist/build/webpack/config/blocks/css/loaders/getCssModuleLocalIdent.js)
// — close to, but not exactly, the `ComponentName-className-uniqueID`
// format asked for (hyphens, not underscores/double-underscores). That
// naming is only reachable through css-loader's `modules.getLocalIdent`,
// which only exists on the classic webpack build (Turbopack's CSS
// Modules implementation — Lightning CSS — has no equivalent public
// option), so this project's dev/build scripts now pass `--webpack`
// (see package.json) instead of using Turbopack.
function getLocalIdent(
  context: { resourcePath: string; rootContext: string },
  _localIdentName: string,
  exportName: string
): string {
  const relativePath = context.resourcePath
    .slice(context.rootContext.length + 1)
    .replace(/\\+/g, "/");
  const componentName = relativePath
    .split("/")
    .pop()!
    .replace(/\.module\.css$/, "");
  const hash = createHash("sha1")
    .update(`${relativePath}:${exportName}`)
    .digest("base64url")
    .slice(0, 5);
  return `${componentName}-${exportName}-${hash}`;
}

// Next assembles its own css-loader rule(s) deep inside `oneOf` arrays
// before handing the config to this customizer — walk the whole rule
// tree and patch every css-loader use entry's `modules.getLocalIdent`
// in place, rather than trying to rebuild Next's CSS pipeline ourselves.
function patchCssModulesNaming(rules: WebpackRule[] | undefined): void {
  for (const rule of rules ?? []) {
    if (!rule || typeof rule !== "object") continue;
    if (Array.isArray(rule.oneOf)) patchCssModulesNaming(rule.oneOf);
    if (Array.isArray(rule.rules)) patchCssModulesNaming(rule.rules);
    const use = rule.use;
    const useItems: WebpackUseItem[] = Array.isArray(use) ? use : use ? [use] : [];
    for (const item of useItems) {
      if (typeof item !== "object" || !item.loader) continue;
      if (!item.loader.includes("css-loader") || item.loader.includes("postcss-loader")) continue;
      if (item.options?.modules && typeof item.options.modules === "object") {
        item.options.modules.getLocalIdent = getLocalIdent;
      }
    }
  }
}

const nextConfig: NextConfig = {
  images: {
    // Poster URLs come from many hosts (Airbnb, VRBO, Flickr, Google
    // Places, Instagram CDN, …). Optimization still runs through
    // /_next/image; this only allowlists which remotes may be fetched.
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "**" },
    ],
    // Next 16 requires an explicit quality allowlist.
    qualities: [75],
    // Cache optimized variants longer so repeat views (Categories scroll,
    // back-nav) hit disk/CDN instead of re-fetching the remote.
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  webpack(config: any) {
    patchCssModulesNaming(config.module?.rules as WebpackRule[] | undefined);
    return config;
  },
  async redirects() {
    return [
      // Multi-trip rewrite: the single-trip site's routes all moved
      // under /maine-2027, with nav grouping now pure data instead of
      // nested URL paths (fragments like #listing-xxx survive a
      // redirect in-browser, so old anchor links keep working).
      { source: "/stayed", destination: "/maine-2027/houses/previously-visited", permanent: true },
      { source: "/houses/previous-stays", destination: "/maine-2027/houses/previously-visited", permanent: true },
      { source: "/food-drink", destination: "/maine-2027/food-drink/options", permanent: true },
      { source: "/food-drink/previously-visited", destination: "/maine-2027/food-drink/previously-visited", permanent: true },
      { source: "/activities", destination: "/maine-2027/activities/options", permanent: true },
      { source: "/activities/previous-activities", destination: "/maine-2027/activities/previously-visited", permanent: true },
    ];
  },
};

export default nextConfig;
