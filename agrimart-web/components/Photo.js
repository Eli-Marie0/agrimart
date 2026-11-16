"use client";

import { useState } from "react";

export default function Photo({ src, media, alt, tint, label, ratio = "4 / 3", className = "", priority = false }) {
  const [failed, setFailed] = useState(false);
  const mediaSrc = typeof media === "string" ? media : media?.url;
  const url = src || mediaSrc;
  const showImage = url && !failed;

  return (
    <div
      className={`ph ${className}`}
      style={{ aspectRatio: ratio, background: showImage ? "var(--zone)" : tint || "var(--zone)" }}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={alt || ""}
          loading={priority ? "eager" : "lazy"}
          onError={() => setFailed(true)}
        />
      ) : (
        <>
          <span className="cross" aria-hidden="true" />
          <span className="lbl">{label || alt || "Photo"}</span>
        </>
      )}
    </div>
  );
}
