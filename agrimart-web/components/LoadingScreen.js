"use client";

import { useEffect, useState } from "react";

export default function LoadingScreen() {
  const [hidden, setHidden] = useState(true);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem("agrimart-loaded") === "1";
    } catch {}
    if (seen) return;
    setHidden(false);
    const timer = window.setTimeout(() => {
      setLeaving(true);
      window.setTimeout(() => {
        setHidden(true);
        try {
          sessionStorage.setItem("agrimart-loaded", "1");
        } catch {}
      }, 260);
    }, 1650);
    return () => window.clearTimeout(timer);
  }, []);

  if (hidden) return null;

  return (
    <div id="ld" className={leaving ? "leaving" : ""} aria-hidden="true">
      <div className="sprout">
        <span className="stem" />
        <span className="leaf l" />
        <span className="leaf r" />
      </div>
      <p>Growing your experience...</p>
      <div className="ld-line"><span /></div>
    </div>
  );
}
