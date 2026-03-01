import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RunwayAI — Your AI Cash Flow Agent",
  description: "Connect your bank account and let AI manage your cash flow operations",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
