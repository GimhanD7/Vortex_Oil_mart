import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === 'production';

const nextConfig: NextConfig = {
  /* config options here */
  output: isProd ? "export" : undefined,
  trailingSlash: isProd,
  images: {
    unoptimized: true,
  },
  // Keep development route compilation fast; enable the compiler for production builds.
  reactCompiler: isProd,
  typescript: {
    ignoreBuildErrors: true,
  },
  async rewrites() {
    if (isProd) return [];
    return [
      {
        source: '/api/:path*',
        // Route API calls to the XAMPP PHP backend during local development
        destination: 'http://localhost/Vortex_Oil_mart/api/:path*',
      }
    ];
  },
};

export default nextConfig;
