import type { Metadata } from "next";
import { Bebas_Neue, Outfit } from "next/font/google";
import "./globals.css";
import { StreamingProvider } from "@/contexts/StreamingContext";

const bebasNeue = Bebas_Neue({
  weight: "400",
  variable: "--font-bebas-neue",
  subsets: ["latin"],
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
});

export const metadata: Metadata = {
  title: "🎮 TikTok LiveGames IA",
  description: "Panel de control para TikTok Lives generados con IA",
  manifest: "/manifest.json",
  themeColor: "#fe2c55",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "LiveGames IA",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`${bebasNeue.variable} ${outfit.variable} antialiased`}>
        <StreamingProvider>
          {children}
        </StreamingProvider>
      </body>
    </html>
  );
}
