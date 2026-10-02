import type { Metadata, Viewport } from "next";
import { Newsreader, Karla } from "next/font/google";
import "./globals.css";
import "./print.css";

const newsreader = Newsreader({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-newsreader",
  display: "swap",
});

const karla = Karla({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-karla",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Tell me a story",
  description:
    "A gentle companion that listens to your stories and turns them into a memoir.",
};

export const viewport: Viewport = {
  themeColor: "#17121c",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${newsreader.variable} ${karla.variable}`}>
      <body className="antialiased">
        <a href="#main" className="skip-link">
          Skip to the conversation
        </a>
        {children}
      </body>
    </html>
  );
}
