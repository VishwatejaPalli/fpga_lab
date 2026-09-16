import type { Metadata, Viewport } from "next";
import "./globals.css";
import { initializeServer } from "@/lib/init";
import { ThemeProvider } from "@/components/theme-provider";
import { NgrokHeader } from "@/components/ngrok-header";

// Initialize backend services on server start
if (typeof window === "undefined") {
  initializeServer();
}

export const metadata: Metadata = {
  title: "FPGA Remote Lab",
  description: "Cloud-based FPGA programming and monitoring platform",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "FPGA Lab",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0f19" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className="antialiased"
      >
        <NgrokHeader />
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}



