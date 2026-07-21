import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Unbound — Your photos, hosted beautifully",
    template: "%s · Unbound",
  },
  description:
    "Upload thousands of photos and share them as fast, beautiful galleries — private or public. Unlimited traffic, unlimited downloads, and nothing is ever deleted without your say-so.",
  metadataBase: new URL("https://unboundalbums.com"),
  openGraph: {
    siteName: "Unbound",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
