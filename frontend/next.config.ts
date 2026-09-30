import type { NextConfig } from 'next'

// In the cluster, Traefik routes /api and /auth on the same origin. For `npm run dev`,
// set BACKEND_URL / KEYCLOAK_URL to proxy those paths to locally running services.
const dev = [
  process.env.BACKEND_URL && { source: '/api/:path*', destination: `${process.env.BACKEND_URL}/api/:path*` },
  process.env.KEYCLOAK_URL && { source: '/auth/:path*', destination: `${process.env.KEYCLOAK_URL}/auth/:path*` },
].filter(Boolean) as { source: string; destination: string }[]

const nextConfig: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  async rewrites() {
    return dev
  },
}

export default nextConfig
