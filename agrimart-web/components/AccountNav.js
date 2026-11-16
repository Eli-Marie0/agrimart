"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth, useToast } from "./Providers";

const LINKS = [
  { href: "/account/orders", label: "My orders" },
  { href: "/account", label: "Profile and addresses" },
];

export default function AccountNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();
  const { push } = useToast();

  return (
    <nav className="dnav" aria-label="Account">
      <div className="who"><b>My account</b>Orders and saved details</div>
      {LINKS.map((link) => (
        <Link key={link.href} href={link.href} aria-current={pathname === link.href ? "page" : undefined}>
          {link.label}
        </Link>
      ))}
      <Link href="/products">Browse products</Link>
      <button
        type="button"
        className="lnk"
        style={{ textAlign: "left", padding: "11px 0" }}
        onClick={() => { logout(); push("Signed out."); router.push("/"); }}
      >
        Sign out
      </button>
    </nav>
  );
}
