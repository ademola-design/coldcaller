export const metadata = {
  title: "AI Cold Caller — Agent Service",
  description: "Vapi webhook handlers and call-trigger API for the AI cold caller.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
