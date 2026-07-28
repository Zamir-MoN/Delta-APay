import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import SmoothScroll from "@/components/SmoothScroll";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Payment Page",
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
          <div className="min-h-screen bg-transparent text-text flex flex-col">

            <main className="flex-grow">
              {children}
            </main>
          </div>
        </SmoothScroll>
      </body>
    </html>
  );
}
