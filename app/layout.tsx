import type { Metadata, Viewport } from "next";
import { Fredoka, Geist_Mono, Nunito } from "next/font/google";
import "./globals.css";

// Fredoka for headings and numbers: round, friendly, unambiguous digits.
// Nunito for reading: open letterforms that hold up for early readers.
const display = Fredoka({ variable: "--font-display", subsets: ["latin"] });
const body = Nunito({ variable: "--font-body", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Tally Tales — maths stories, one child at a time",
  description:
    "An adaptive maths companion for autistic K–2 learners. An on-device model plans each puzzle; the engine owns every number.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#fbf6ec",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
