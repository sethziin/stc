import type React from "react"
import type { Metadata } from "next"
import { Josefin_Sans } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"

const josefinSans = Josefin_Sans({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-josefin",
})

export const metadata: Metadata = {
  title: "stc",
  description: "A mysterious journey",
  generator: "v0.app",
  icons: {
    icon: "/favicon.ico", // 👈 usa o novo favicon
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${josefinSans.variable} font-josefin antialiased`}
        suppressHydrationWarning
      >
        {children}
        <Analytics />
      </body>
    </html>
  )
}
