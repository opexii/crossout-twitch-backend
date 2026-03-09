/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appDir: true,
  },
  async headers() {
    return [
      {
        source: "/overlay",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors https://www.twitch.tv https://supervisor.twitch.tv https://extension-files.twitch.tv",
          },
        ],
      },
    ];
  },
};

export default nextConfig;

