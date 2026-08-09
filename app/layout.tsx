import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;

  return {
    metadataBase: new URL(origin),
    title: {
      default: "CashX Ecosystem NFT",
      template: "%s · CashX Ecosystem",
    },
    description:
      "Mint the 10,000-piece CashX Ecosystem NFT collection on PulseChain.",
    icons: {
      icon: "/favicon.svg",
      shortcut: "/favicon.svg",
    },
    openGraph: {
      title: "CashX Ecosystem NFT",
      description: "10,000 NFTs · 1,000,000 PLS · No Deadline · Built on PulseChain",
      type: "website",
      images: [{ url: `${origin}/og.png`, width: 1732, height: 909, alt: "CashX Ecosystem NFT" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "CashX Ecosystem NFT",
      description: "10,000 NFTs · 1,000,000 PLS · No Deadline · Built on PulseChain",
      images: [`${origin}/og.png`],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
