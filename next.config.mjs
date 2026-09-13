/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      // Multi-trip rewrite: the single-trip site's routes all moved
      // under /maine-2027, with nav grouping now pure data instead of
      // nested URL paths (fragments like #listing-xxx survive a
      // redirect in-browser, so old anchor links keep working).
      { source: "/stayed", destination: "/maine-2027/previous-stays", permanent: true },
      { source: "/houses/previous-stays", destination: "/maine-2027/previous-stays", permanent: true },
      { source: "/food-drink", destination: "/maine-2027/food-drink", permanent: true },
      { source: "/food-drink/previously-visited", destination: "/maine-2027/previously-visited", permanent: true },
      { source: "/activities", destination: "/maine-2027/activities", permanent: true },
      { source: "/activities/previous-activities", destination: "/maine-2027/previous-activities", permanent: true },
    ];
  },
};

export default nextConfig;
