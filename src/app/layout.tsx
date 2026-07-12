import type { Metadata, Viewport } from "next";
import "./globals.css";
import { initializeServer } from "@/lib/init";
import { ThemeProvider } from "@/components/theme-provider";

// Initialize backend services on server start
if (typeof window === "undefined") {
  initializeServer();
}

export const metadata: Metadata = {
  title: "FPGA Remote Lab",
  description: "Cloud-based FPGA programming and monitoring platform",
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
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
