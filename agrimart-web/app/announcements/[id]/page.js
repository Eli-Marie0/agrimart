import Link from "next/link";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { dayParts, longDate } from "@/lib/format";


export default async function AnnouncementPage({ params }) {
  const { id } = await params;
  let item = null;
  try {
    const all = (await api("/store/announcements")).data || [];
    item = all.find((entry) => String(entry.id) === String(id));
  } catch {}
  if (!item) notFound();

  const parts = dayParts(item.publishedAt || item.createdAt);

  return (
    <div className="wrap pad">
      <p className="crumb"><Link href="/announcements">Announcements</Link> / {item.title}</p>
      <article style={{ maxWidth: 760 }}>
        <div className="date" style={{ display: "flex", gap: 12, alignItems: "baseline", marginBottom: 12 }}>
          <b style={{ fontFamily: "var(--f-head)", fontSize: 36 }}>{parts.day}</b>
          <span className="meta">{parts.month} {parts.year}</span>
          {item.isPinned ? <span className="pin" style={{ marginLeft: 0 }}>Pinned</span> : null}
        </div>
        <h1 style={{ fontSize: "clamp(30px, 4vw, 44px)", marginBottom: 8 }}>{item.title}</h1>
        <p className="meta" style={{ marginBottom: 32 }}>
          {longDate(item.publishedAt || item.createdAt)}
          {item.author?.fullName ? ` · ${item.author.fullName}` : ""}
        </p>
        <div style={{ whiteSpace: "pre-line", fontSize: 17, lineHeight: 1.7 }}>{item.body}</div>
      </article>
      <p style={{ marginTop: 48 }}>
        <Link href="/announcements" className="btn">All announcements</Link>
      </p>
    </div>
  );
}
