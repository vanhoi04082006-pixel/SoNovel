import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import "./globals.css";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";

const beVietnam = Be_Vietnam_Pro({
  variable: "--font-vietnamese",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "SoNovel — Nghe truyện chữ bằng giọng đọc tổng hợp",
  description: "SoNovel: ứng dụng nghe truyện chữ Việt Nam với giọng đọc TTS. Duyệt, tìm kiếm, nghe truyện mọi lúc, kể cả khi rời màn hình.",
  keywords: ["SoNovel", "nghe truyện", "truyện chữ", "TTS tiếng Việt", "audiobook Việt"],
  authors: [{ name: "SoNovel" }],
  manifest: "/manifest.json",
  icons: {
    icon: "/icon-192.png",
    apple: "/icon-192.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "SoNovel",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#d97706" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

// Register service worker — moved to client component (see PWARegister)

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" data-theme="light" suppressHydrationWarning>
      <head>
        {/* Apply theme before paint to avoid flash */}
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            try {
              var t = localStorage.getItem('sonovel-theme');
              if (!t) t = 'light';
              document.documentElement.setAttribute('data-theme', t);
            } catch (e) {}
          })();
        `}} />
      </head>
      <body
        className={`${beVietnam.variable} font-sans antialiased bg-background text-foreground`}
      >
        {children}
        <SonnerToaster position="top-center" richColors />
      </body>
    </html>
  );
}
