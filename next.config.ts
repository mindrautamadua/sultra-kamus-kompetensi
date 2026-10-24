import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  redirects() {
    return [
      { source: "/admin", destination: "/admin/pengguna", permanent: false },
      // halaman Pengguna lama, sekarang bagian dari Admin
      { source: "/pengguna", destination: "/admin/pengguna", permanent: true },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
