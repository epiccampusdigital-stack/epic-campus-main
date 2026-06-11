/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  images: { unoptimized: true },
  experimental: {
    workerThreads: false,
    cpus: 1,
    optimizePackageImports: ['recharts'],
    serverComponentsExternalPackages: ['firebase-admin'],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : []),
        '@grpc/grpc-js',
        '@grpc/proto-loader',
        'protobufjs',
      ]
    }
    return config
  },
}

export default nextConfig
