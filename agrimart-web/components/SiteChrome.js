"use client";

import { usePathname } from "next/navigation";
import Header from "./Header";
import Footer from "./Footer";

const DASHBOARD = ["/admin", "/staff"];

function isDashboard(pathname) {
  return DASHBOARD.some((base) => pathname === base || pathname.startsWith(`${base}/`));
}

export default function SiteChrome({ children }) {
  const pathname = usePathname() || "";
  const dashboard = isDashboard(pathname);

  return (
    <>
      {dashboard ? null : <Header />}
      <main id="main">{children}</main>
      {dashboard ? null : <Footer />}
    </>
  );
}
