import { readFileSync } from 'fs'

const version = readFileSync('./VERSION.md', 'utf8').trim()

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: version,
  },
  output: 'standalone',
}

export default nextConfig
