/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  images: { unoptimized: true },
  experimental: {
    workerThreads: false,
    cpus: 1,
    optimizePackageImports: ['recharts'],
    serverComponentsExternalPackages: ['firebase-admin', '@emoji-mart/data'],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : []),
        '@grpc/grpc-js',
        '@grpc/proto-loader',
        'protobufjs',
        '@emoji-mart/data',
      ]
    }
    return config
  },
}

export default nextConfig
