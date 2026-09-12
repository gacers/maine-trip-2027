/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      // "Stayed Before" moved under the Houses tab as a sub-page.
      { source: "/stayed", destination: "/houses/previous-stays", permanent: true },
    ];
  },
};

export default nextConfig;
