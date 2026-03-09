import Script from "next/script";

export default function OverlayLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* Официальный скрипт Twitch Extension Helper — нужен, когда оверлей открыт во фрейме расширения */}
      <Script
        src="https://extension-files.twitch.tv/helper/v1/twitch-ext.min.js"
        strategy="beforeInteractive"
      />
      {children}
    </>
  );
}
