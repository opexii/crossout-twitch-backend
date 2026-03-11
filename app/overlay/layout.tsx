const TWITCH_HELPER_URL =
  "https://extension-files.twitch.tv/helper/v1/twitch-ext.min.js";

export default function OverlayLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* Скрипт в начальном HTML — иначе во фрейме Twitch "Extension Helper Library Not Loaded" */}
      <script src={TWITCH_HELPER_URL} suppressHydrationWarning />
      {children}
    </>
  );
}
