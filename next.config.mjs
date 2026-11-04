/** @type {import('next').NextConfig} */
const nextConfig = {
  // Set NEXT_PUBLIC_BASE_PATH (e.g. /projects/growmore) at build time to serve under a sub-path.
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || undefined,
  experimental: { serverComponentsExternalPackages: ["better-sqlite3"] },
};
export default nextConfig;
