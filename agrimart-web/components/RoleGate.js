"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "./Providers";

export default function RoleGate({ roles = ["staff", "admin"], children }) {
  const { user, ready } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const allowed = ready && user && roles.includes(user.roleName);

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    if (!roles.includes(user.roleName)) {
      const staffOrAdmin = user.roleName === "staff" || user.roleName === "admin";
      router.replace(staffOrAdmin ? "/forbidden" : "/");
    }
  }, [ready, user, roles, router, pathname]);

  if (!allowed) {
    return (
      <div className="wrap pad">
        <div className="empty">
          <h2>{ready ? "Checking access" : "Loading your account"}</h2>
          <p>{ready ? "Taking you to the right place." : "One moment."}</p>
        </div>
      </div>
    );
  }

  return children;
}
