import { readFileSync } from 'fs'

const version = readFileSync('./VERSION.md', 'utf8').trim()

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: version,
  },
  output: 'standalone',
  experimental: {
    // Ensure puppeteer-core (used by /api/report/pdf) survives standalone bundling
    outputFileTracingIncludes: {
      '/api/report/pdf': ['./node_modules/puppeteer-core/**/*'],
    },
  },
}

export default nextConfig
