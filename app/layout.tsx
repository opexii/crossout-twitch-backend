export const metadata = {
  title: "Crossout Twitch Backend",
  description: "Backend API for Crossout Twitch extension",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

