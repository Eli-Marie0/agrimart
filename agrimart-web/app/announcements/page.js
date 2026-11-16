import Link from "next/link";
import { api } from "@/lib/api";
import { dayParts, longDate } from "@/lib/format";

export const metadata = { title: "Announcements" };

export default async function AnnouncementsPage() {
  let announcements = [];
  try {
    announcements = (await api("/store/announcements")).data || [];
  } catch {}

  return (
    <div className="wrap pad">
      <header className="page-h">
        <p className="eyebrow">Store notes</p>
        <h1>Announcements</h1>
        <p>Promos, planting-season tips and product advisories from the AgriMart team. Pinned notes stay at the top.</p>
      </header>

      {announcements.length ? (
        <div className="adv-list">
          {announcements.map((item) => {
            const parts = dayParts(item.publishedAt || item.createdAt);
            return (
              <article className="adv" key={item.id}>
                <div className="date">
                  <b>{parts.day}</b>
                  <span>{parts.month}</span>
                </div>
                <div>
                  <h2 style={{ fontSize: 22, marginBottom: 6 }}>
                    <Link href={`/announcements/${item.id}`}>{item.title}</Link>
                    {item.isPinned ? <span className="pin">Pinned</span> : null}
                  </h2>
                  <p className="meta" style={{ margin: "0 0 8px" }}>
                    {longDate(item.publishedAt || item.createdAt)}
                    {item.author?.fullName ? ` · ${item.author.fullName}` : ""}
                  </p>
                  <p>{item.excerpt}</p>
                  <Link href={`/announcements/${item.id}`} className="link-quiet">Read the full note</Link>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="empty">
          <h2>No announcements yet.</h2>
          <p>New advisories appear here as soon as the store publishes them.</p>
          <Link href="/products" className="btn" style={{ marginTop: 12 }}>Browse supplies</Link>
        </div>
      )}
    </div>
  );
}
