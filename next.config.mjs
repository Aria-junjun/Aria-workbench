/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep production verification separate from the running local development server.
  ...(process.env.WORKBENCH_VERIFY_BUILD === '1' ? { distDir: '.next-verify' } : {}),
  // Enable React Strict Mode for better development experience
  reactStrictMode: true,

  // Image optimization configuration
  images: {
    unoptimized: true
  },

  // TypeScript configuration - fail on errors in production builds
  typescript: {
    ignoreBuildErrors: false
  },

  // ESLint configuration
  eslint: {
    ignoreDuringBuilds: false
  },

  // Experimental features for better performance
  experimental: {
    // Optimize package imports for faster builds
    optimizePackageImports: ['lucide-react']
  }
};

export default nextConfig;
