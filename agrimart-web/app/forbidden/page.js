"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/Providers";

export default function ForbiddenPage() {
  const { user, ready } = useAuth();
  const router = useRouter();
  const staffOrAdmin = user?.roleName === "staff" || user?.roleName === "admin";

  useEffect(() => {
    if (ready && !staffOrAdmin) router.replace("/");
  }, [ready, staffOrAdmin, router]);

  if (!ready || !staffOrAdmin) {
    return <div className="wrap pad"><p className="mut">Returning to the store...</p></div>;
  }

  return (
    <div className="wrap">
      <div className="sys">
        <p className="eyebrow">403</p>
        <h1>Not your page.</h1>
        <p>This area is for store staff or administrators. If you think you should have access, ask the store owner to update your account.</p>
        <div className="btn-row">
          <Link href="/" className="btn p">Back to the store</Link>
          <Link href="/account" className="btn">My account</Link>
        </div>
      </div>
    </div>
  );
}
