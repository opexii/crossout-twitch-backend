const cspOverlay =
  "frame-ancestors https://www.twitch.tv https://player.twitch.tv https://embed.twitch.tv https://supervisor.twitch.tv https://supervisor.ext-twitch.tv https://*.ext-twitch.tv https://extension-files.twitch.tv https://ext-twitch.tv https://twitch.tv; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://extension-files.twitch.tv";

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appDir: true,
  },
  async rewrites() {
    return [
      // Twitch "Видео: на весь экран" ожидает путь video_overlay.html
      { source: "/video_overlay.html", destination: "/overlay" },
    ];
  },
  async headers() {
    return [
      { source: "/overlay", headers: [{ key: "Content-Security-Policy", value: cspOverlay }] },
      { source: "/video_overlay.html", headers: [{ key: "Content-Security-Policy", value: cspOverlay }] },
    ];
  },
};

export default nextConfig;

