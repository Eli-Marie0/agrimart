"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { publicApi } from "@/lib/api";
import { useCart } from "@/lib/cart";
import { useAuth, useToast } from "./Providers";

const LINKS = [
  { href: "/products", label: "Products" },
  { href: "/announcements", label: "Announcements" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { count } = useCart();
  const { user, logout, isStaff, isAdmin } = useAuth();
  const isCustomer = user?.roleName === "customer";
  const { push } = useToast();
  const isAdminArea = pathname === "/admin" || pathname.startsWith("/admin/");
  const isStaffArea = pathname === "/staff" || pathname.startsWith("/staff/");
  const isWorkArea = isAdminArea || isStaffArea;
  const [open, setOpen] = useState(false);
  const [bar, setBar] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    let alive = true;
    publicApi.settings()
      .then((payload) => { if (alive) setBar(payload?.data?.announcementBar || ""); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  useEffect(() => { setOpen(false); }, [pathname]);

  function submitSearch(event) {
    event.preventDefault();
    const q = query.trim();
    router.push(q ? `/products?q=${encodeURIComponent(q)}` : "/products");
    setOpen(false);
  }

  const active = (href) => (pathname === href || pathname.startsWith(`${href}/`) ? "page" : undefined);

  return (
    <header className="hdr">
      {bar ? (
        <div className="annbar">
          <div className="wrap"><p>{bar}</p></div>
        </div>
      ) : null}
      <div className="wrap hdr-in">
        {!isAdminArea ? <Link href="/" className="logo">AgriMart</Link> : null}

        {!isWorkArea ? (
          <nav className="hnav" aria-label="Main">
            {LINKS.map((link) => (
              <Link key={link.href} href={link.href} aria-current={active(link.href)}>{link.label}</Link>
            ))}
          </nav>
        ) : null}

        <div className="hdr-tools">
          {!isWorkArea ? (
            <form className="hsearch" role="search" onSubmit={submitSearch}>
              <label htmlFor="site-search" className="sr">Search products</label>
              <input
                id="site-search"
                className="fld"
                type="search"
                placeholder="Search supplies"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <button type="submit" className="btn s">Search</button>
            </form>
          ) : null}

          {!isWorkArea && isCustomer ? <Link href="/cart" className="cartlink">Cart ({count})</Link> : null}

          {user ? (
            <Link href="/account" className="acctlink" aria-current={active("/account")}>
              {user.fullName?.split(" ")[0] || "Account"}
            </Link>
          ) : (
            <Link href="/login" className="acctlink">Sign in</Link>
          )}

          {isStaff && !isAdminArea ? (
            <Link href="/staff" className="acctlink" aria-current={active("/staff")}>Staff</Link>
          ) : null}
          {isAdmin && !isWorkArea ? (
            <Link href="/admin" className="acctlink" aria-current={active("/admin")}>Admin</Link>
          ) : null}

          {user ? (
            <button
              type="button"
              className="lnk"
              onClick={() => { logout(); push("Signed out."); router.push("/"); }}
            >
              Sign out
            </button>
          ) : null}
        </div>

        {!isWorkArea ? <button
          type="button"
          className="menu-btn btn s"
          aria-expanded={open}
          aria-controls="mobile-menu"
          onClick={() => setOpen(!open)}
        >
          {open ? "Close" : "Menu"}
        </button> : null}
      </div>

      {!isWorkArea ? <div id="mobile-menu" className={`mobmenu ${open ? "on" : ""}`} hidden={!open}>
        <div className="wrap">
          <form className="msearch" role="search" onSubmit={submitSearch}>
            <label htmlFor="mobile-search" className="sr">Search products</label>
            <input
              id="mobile-search"
              className="fld"
              type="search"
              placeholder="Search supplies"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <button type="submit" className="btn">Search</button>
          </form>
          <nav aria-label="Mobile">
            {!isWorkArea ? <>
              <Link href="/">Home</Link>
              {LINKS.map((link) => (
                <Link key={link.href} href={link.href} aria-current={active(link.href)}>{link.label}</Link>
              ))}
              {isCustomer ? <Link href="/cart">Cart ({count})</Link> : null}
            </> : null}
            {user ? <Link href="/account">My account</Link> : <Link href="/login">Sign in</Link>}
            {isStaff ? <Link href="/staff">Staff dashboard</Link> : null}
            {isAdmin ? <Link href="/admin">Admin dashboard</Link> : null}
            {user ? (
              <button type="button" className="lnk" onClick={() => { logout(); push("Signed out."); router.push("/"); }}>
                Sign out
              </button>
            ) : null}
          </nav>
        </div>
      </div> : null}
    </header>
  );
}
