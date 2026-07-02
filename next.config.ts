import type { NextConfig } from 'next'

const config: NextConfig = {
  turbopack: { root: import.meta.dirname },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: '**' },
    ],
  },
}

export default config
