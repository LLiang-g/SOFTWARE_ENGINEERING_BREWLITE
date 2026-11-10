import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro, Bricolage_Grotesque } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import Navbar from '@/components/Navbar';

const bodyFont = Be_Vietnam_Pro({
  variable: "--font-body",
  subsets: ["latin", "latin-ext", "vietnamese"],
  weight: ["400", "500", "600", "700"],
});

const displayFont = Bricolage_Grotesque({
  variable: "--font-display-face",
  subsets: ["latin", "latin-ext", "vietnamese"],
});

export const metadata: Metadata = {
  title: "BrewLite",
  description: "Đặt cà phê trước, trả không tiền mặt, ghé quầy lấy nước.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f3f2ee",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="vi"
      className={`${bodyFont.variable} ${displayFont.variable} h-full antialiased`}
    >
      <body className="flex min-h-dvh flex-col font-sans">
        <Suspense>
          <Navbar />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
