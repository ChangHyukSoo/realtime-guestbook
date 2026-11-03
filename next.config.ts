import type { NextConfig } from 'next';
const nextConfig: NextConfig = {
  agentRules: false,
  allowedDevOrigins: ['192.168.55.162'],
  experimental: { serverActions: { bodySizeLimit: '6mb' } },
};
export default nextConfig;
