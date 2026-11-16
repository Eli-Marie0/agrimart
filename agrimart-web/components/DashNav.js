"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth, useToast } from "./Providers";

const STAFF = [
  { href: "/staff", label: "Today" },
  { href: "/staff/orders", label: "Orders" },
  { href: "/staff/inventory", label: "Inventory" },
];

const ADMIN = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/inventory", label: "Inventory" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/reviews", label: "Reviews" },
  { href: "/admin/announcements", label: "Announcements" },
  { href: "/admin/content", label: "Site content" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/settings", label: "Settings" },
];

export default function DashNav({ kind = "staff" }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { push } = useToast();
  const links = kind === "admin" ? ADMIN : STAFF;
  const isAdmin = user?.roleName === "admin";

  return (
    <nav className="dnav" aria-label={`${kind === "admin" ? "Admin" : "Staff"} sections`}>
      <div className="who">
        <b>{user?.fullName || "Team member"}</b>
        {kind === "admin" ? "Administrator" : isAdmin ? "Administrator" : "Store staff"}
      </div>
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          aria-current={pathname === link.href ? "page" : undefined}
        >
          {link.label}
        </Link>
      ))}
      {kind === "staff" && isAdmin ? <Link href="/admin">Switch to admin</Link> : null}
      <Link href="/">View storefront</Link>
      <button
        type="button"
        className="lnk"
        style={{ textAlign: "left", padding: "11px 0", width: "100%" }}
        onClick={() => { logout(); push("Signed out."); router.push("/"); }}
      >
        Sign out
      </button>
    </nav>
  );
}
