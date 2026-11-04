import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const pretendard = localFont({
  src: "../assets/fonts/PretendardVariable.woff2",
  variable: "--font-body",
  weight: "100 900",
  display: "optional",
  fallback: ["Malgun Gothic", "Apple SD Gothic Neo", "sans-serif"],
  adjustFontFallback: false,
});

const gmarketSans = localFont({
  src: [
    { path: "../assets/fonts/GmarketSansMedium.woff2", weight: "500", style: "normal" },
    { path: "../assets/fonts/GmarketSansBold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-display",
  display: "optional",
  fallback: ["var(--font-body)", "Malgun Gothic", "Apple SD Gothic Neo", "sans-serif"],
  adjustFontFallback: false,
});

export const metadata: Metadata = {
  title: "AI 면접",
  description: "나의 자기소개서를 바탕으로 차분하게 연습하는 AI 음성 면접",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" className={`${pretendard.variable} ${gmarketSans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
