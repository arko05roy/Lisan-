import type { Metadata } from "next";
import { IBM_Plex_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "next-themes";
import { StarknetProvider } from "@/components/providers/starknet-provider";
import { Toaster } from "@/components/ui/sonner";

const ibmPlexSans = IBM_Plex_Sans({
  weight: ["400", "500", "600", "700"],
  variable: "--font-ibm-plex",
  subsets: ["latin"],
});

const jetBrainsMono = JetBrains_Mono({
  weight: ["400", "500", "600"],
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

import { Italiana } from "next/font/google";

const italiana = Italiana({
  subsets: ["latin"],
  variable: "--font-italiana",
  weight: "400",
});

export const metadata: Metadata = {
  title: "Lisan Wallet — Private Execution on Starknet",
  description:
    "The privacy-first wallet for Starknet. Execute transactions privately, manage shielded assets, and interact with contracts anonymously.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${ibmPlexSans.variable} ${jetBrainsMono.variable} ${italiana.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <StarknetProvider>
            {children}
            <Toaster richColors position="bottom-right" />
          </StarknetProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
