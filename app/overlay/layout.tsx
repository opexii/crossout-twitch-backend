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
      {/* Тёмная полоса прокрутки без белого фона (Chrome + Firefox) */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            .overlay-scroll {
              scrollbar-width: thin;
              scrollbar-color: #555 #252525;
            }
            .overlay-scroll::-webkit-scrollbar {
              width: 10px;
            }
            .overlay-scroll::-webkit-scrollbar-track {
              background: #252525;
            }
            .overlay-scroll::-webkit-scrollbar-thumb {
              background: #555;
              border-radius: 5px;
            }
            .overlay-scroll::-webkit-scrollbar-thumb:hover {
              background: #666;
            }
          `,
        }}
      />
      {children}
    </>
  );
}
