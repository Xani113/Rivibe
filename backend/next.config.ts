import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['node:sqlite'],
  turbopack: {
    root: import.meta.dirname,
  },
};

export default nextConfig;
