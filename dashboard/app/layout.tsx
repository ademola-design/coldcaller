import "./globals.css";

export const metadata = {
  title: "AI Cold Caller — Appointments",
  description: "Dashboard for leads, appointments, and call history.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">{children}</body>
    </html>
  );
}
