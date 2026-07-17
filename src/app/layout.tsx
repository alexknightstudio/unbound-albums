import type { Metadata } from "next";
import { Cormorant_Garamond, Jost } from "next/font/google";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  // 300 for large display only; 400/500 for smaller serif moments (the
  // readability rule: never Light below 36px). Italics are the tagline voice.
  weight: ["300", "400", "500"],
  style: ["normal", "italic"],
  display: "swap",
});

const jost = Jost({
  variable: "--font-jost",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Unbound Albums — Your love story, unbound.",
    template: "%s · Unbound Albums",
  },
  description:
    "Your favorite wedding photos, designed into a printed album. Upload around 150. We'll do the rest.",
  metadataBase: new URL("https://unboundalbums.com"),
  openGraph: {
    siteName: "Unbound Albums",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${cormorant.variable} ${jost.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
