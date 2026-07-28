import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import SmoothScroll from "@/components/SmoothScroll";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Delta X Tool - Auto UPI Verification",
  description: "Seamless and instant UPI payment verification.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <SmoothScroll>
          <div className="min-h-screen bg-background text-text flex flex-col">
            <nav className="w-full glass-panel py-4 px-6 flex justify-between items-center sticky top-0 z-50">
              <div className="font-bold text-xl tracking-tighter text-white">
                DELTA<span className="text-primary">X</span>
              </div>
              <div className="flex gap-4">
                <a href="/" className="text-sm font-medium hover:text-accent transition-colors">Home</a>
              </div>
            </nav>
            <main className="flex-grow">
              {children}
            </main>
          </div>
        </SmoothScroll>
      </body>
    </html>
  );
}
