"use client";

import { useState } from "react";
import Photo from "./Photo";

export default function Gallery({ images, alt, tint, label }) {
  const list = (images || []).filter(Boolean);
  const [index, setIndex] = useState(0);
  const current = list[index] || null;

  return (
    <div>
      <Photo src={current} alt={`${alt}${index ? `, view ${index + 1}` : ""}`} tint={tint} label={label} ratio="4 / 3" priority className="gallery-main" />
      {list.length > 1 ? (
        <div className="thumbs" role="group" aria-label="Product photos">
          {list.map((url, position) => (
            <button
              key={`${url}-${position}`}
              type="button"
              onClick={() => setIndex(position)}
              aria-label={`Show photo ${position + 1} of ${list.length}`}
              aria-pressed={position === index}
              style={{ border: position === index ? "2px solid var(--ink)" : "1px solid var(--bd)", padding: 0, background: "none", cursor: "pointer" }}
            >
              <Photo src={url} alt="" tint={tint} label="" ratio="1 / 1" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
