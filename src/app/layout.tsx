import type { Metadata, Viewport } from "next";
import { Geist, Instrument_Serif, Zilla_Slab } from "next/font/google";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });
const instrument = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument",
  display: "swap",
});
const zilla = Zilla_Slab({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-zilla", display: "swap" });

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

export const metadata: Metadata = {
  metadataBase: siteUrl ? new URL(siteUrl) : undefined,
  title: {
    default: "Adega Central Morato · Cardápio",
    template: "%s · Adega Central Morato",
  },
  description: "Bebidas geladas, gelo e conveniência. Monte seu pedido e envie pelo WhatsApp.",
  openGraph: {
    title: "Adega Central Morato · Cardápio",
    description: "Bebidas geladas, gelo e conveniência. Monte seu pedido e envie pelo WhatsApp.",
    type: "website",
    locale: "pt_BR",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0d0d0d",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${geist.variable} ${instrument.variable} ${zilla.variable}`}>
      <body>{children}</body>
    </html>
  );
}
