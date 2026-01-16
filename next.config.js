/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    config.resolve.alias.canvas = false;
    config.resolve.alias.encoding = false;
    
    // Don't bundle pdfjs-dist on server side
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push('pdfjs-dist');
    }
    
    return config;
  },
}

module.exports = nextConfig
