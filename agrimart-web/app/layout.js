import localFont from "next/font/local";
import SiteChrome from "@/components/SiteChrome";
import Providers from "@/components/Providers";
import LoadingScreen from "@/components/LoadingScreen";
import "./globals.css";

const archivo = localFont({
  src: "./fonts/archivo-latin.woff2",
  weight: "100 900",
  variable: "--f-head",
  display: "swap",
});
const hanken = localFont({
  src: "./fonts/hanken-grotesk-latin.woff2",
  weight: "100 900",
  variable: "--f-body",
  display: "swap",
});

export const metadata = {
  title: {
    default: "AgriMart — Farm supplies in Victoria, Oriental Mindoro",
    template: "%s — AgriMart",
  },
  description: "Check live stock and prices for seeds, feed, fertilizer, veterinary supplies and tools. Order for delivery or pick up at our Victoria store.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${archivo.variable} ${hanken.variable}`}>
      <body>
        <Providers>
          <a className="skip" href="#main">Skip to content</a>
          <LoadingScreen />
          <SiteChrome>{children}</SiteChrome>
        </Providers>
      </body>
    </html>
  );
}
