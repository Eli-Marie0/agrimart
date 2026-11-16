"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import DashNav from "./DashNav";
import RoleGate from "./RoleGate";
import { useToast } from "./Providers";
import { adminApi } from "@/lib/api";
import { dateTime } from "@/lib/format";

export default function AdminContent() {
  const { push } = useToast();
  const [content, setContent] = useState(null);
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([adminApi.content(), adminApi.messages()])
      .then(([contentPayload, messagePayload]) => {
        setContent(contentPayload.data);
        setMessages(messagePayload.data || []);
        setError("");
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  function field(section, key) {
    return (event) => setContent((current) => ({
      ...current,
      [section]: { ...current[section], [key]: event.target.value },
    }));
  }

  async function save(section) {
    setError("");
    setBusy(section);
    try {
      const data = content[section];
      if (section === "home") await adminApi.updateHome(data);
      else if (section === "about") await adminApi.updateAbout(data);
      else if (section === "contact") {
        await adminApi.updateContact({
          ...data,
          latitude: Number(data.latitude || 0),
          longitude: Number(data.longitude || 0),
        });
      }
      push("Site content saved.");
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  async function setMessageStatus(message, status) {
    setBusy(`msg-${message.id}`);
    try {
      await adminApi.updateMessage(message.id, { status });
      push(`Message marked ${status}.`);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  async function deleteMessage(message) {
    if (!window.confirm("Delete this message?")) return;
    setBusy(`del-${message.id}`);
    try {
      await adminApi.deleteMessage(message.id);
      push("Message deleted.");
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  return (
    <RoleGate roles={["admin"]}>
      <div className="dash">
        <DashNav kind="admin" />
        <div className="dmain">
          <header className="dhead">
            <div>
              <p className="eyebrow">Content</p>
              <h1>Site content</h1>
              <p>Edit the home hero, the About story and the store contact details without code. Photos stay as replaceable slots.</p>
            </div>
            <div className="btn-row">
              <Link href="/" className="btn">View home</Link>
              <Link href="/contact" className="btn">View contact</Link>
            </div>
          </header>

          {error ? <p className="err" role="alert">{error}</p> : null}
          {loading && !content ? <p className="load-note">Loading content...</p> : null}

          {content ? (
            <>
              <section className="editor" style={{ marginTop: 0 }}>
                <h2>Home hero</h2>
                <div className="form">
                  <div className="f2">
                    <div className="frow">
                      <label htmlFor="h-kicker">Kicker</label>
                      <input id="h-kicker" className="fld" value={content.home.kicker} onChange={field("home", "kicker")} />
                    </div>
                    <div className="frow">
                      <label htmlFor="h-image">Hero photo URL</label>
                      <input id="h-image" className="fld" value={content.home.heroImageUrl} onChange={field("home", "heroImageUrl")} placeholder="https://…" />
                    </div>
                  </div>
                  <div className="frow">
                    <label htmlFor="h-title">Hero heading</label>
                    <input id="h-title" className="fld" value={content.home.heroTitle} onChange={field("home", "heroTitle")} />
                  </div>
                  <div className="frow">
                    <label htmlFor="h-text">Hero paragraph</label>
                    <textarea id="h-text" className="fld" value={content.home.heroText} onChange={field("home", "heroText")} />
                  </div>
                  <div className="f2">
                    <div className="frow">
                      <label htmlFor="h-promo-title">Promo heading</label>
                      <input id="h-promo-title" className="fld" value={content.home.promoTitle} onChange={field("home", "promoTitle")} />
                    </div>
                    <div className="frow">
                      <label htmlFor="h-promo-text">Promo text</label>
                      <input id="h-promo-text" className="fld" value={content.home.promoText} onChange={field("home", "promoText")} />
                    </div>
                  </div>
                  <div><button type="button" className="btn p" onClick={() => save("home")} disabled={busy === "home"}>{busy === "home" ? "Saving..." : "Save home"}</button></div>
                </div>
              </section>

              <section className="editor">
                <h2>About the store</h2>
                <div className="form">
                  <div className="frow">
                    <label htmlFor="a-title">Page title</label>
                    <input id="a-title" className="fld" value={content.about.title} onChange={field("about", "title")} />
                  </div>
                  <div className="frow">
                    <label htmlFor="a-body">Story</label>
                    <textarea id="a-body" className="fld" style={{ minHeight: 180 }} value={content.about.body} onChange={field("about", "body")} />
                  </div>
                  <div className="frow">
                    <label htmlFor="a-image">Photo URL</label>
                    <input id="a-image" className="fld" value={content.about.imageUrl} onChange={field("about", "imageUrl")} placeholder="https://…" />
                  </div>
                  <div><button type="button" className="btn" onClick={() => save("about")} disabled={busy === "about"}>{busy === "about" ? "Saving..." : "Save about page"}</button></div>
                </div>
              </section>

              <section className="editor">
                <h2>Store contact and map</h2>
                <div className="form">
                  <div className="frow">
                    <label htmlFor="c-address">Address</label>
                    <input id="c-address" className="fld" value={content.contact.address} onChange={field("contact", "address")} />
                  </div>
                  <div className="frow">
                    <label htmlFor="c-hours">Hours (one line per row)</label>
                    <textarea id="c-hours" className="fld" value={content.contact.hours} onChange={field("contact", "hours")} />
                  </div>
                  <div className="f2">
                    <div className="frow">
                      <label htmlFor="c-phone">Phone</label>
                      <input id="c-phone" className="fld" value={content.contact.phone} onChange={field("contact", "phone")} />
                    </div>
                    <div className="frow">
                      <label htmlFor="c-email">Email</label>
                      <input id="c-email" className="fld" type="email" value={content.contact.email} onChange={field("contact", "email")} />
                    </div>
                  </div>
                  <div className="f2">
                    <div className="frow">
                      <label htmlFor="c-lat">Map latitude</label>
                      <input id="c-lat" className="fld" type="number" step="0.000001" value={content.contact.latitude} onChange={field("contact", "latitude")} />
                    </div>
                    <div className="frow">
                      <label htmlFor="c-lng">Map longitude</label>
                      <input id="c-lng" className="fld" type="number" step="0.000001" value={content.contact.longitude} onChange={field("contact", "longitude")} />
                    </div>
                  </div>
                  <div><button type="button" className="btn" onClick={() => save("contact")} disabled={busy === "contact"}>{busy === "contact" ? "Saving..." : "Save contact details"}</button></div>
                </div>
              </section>

              <section className="editor">
                <div className="panel-h"><h2>Contact messages</h2><span className="meta">{messages.filter((message) => message.status === "new").length} new</span></div>
                {messages.length ? messages.map((message) => (
                  <article className="msg-card" key={message.id}>
                    <div className="panel-h">
                      <h3>{message.subject || "Website message"} <span className={`tag ${message.status === "new" ? "warn" : ""}`}>{message.status}</span></h3>
                      <span className="meta">{dateTime(message.createdAt)}</span>
                    </div>
                    <div className="meta">
                      <span>{message.name} · {message.email}</span>
                      {message.phone ? <span>{message.phone}</span> : null}
                    </div>
                    <p style={{ whiteSpace: "pre-line" }}>{message.message}</p>
                    <div className="btn-row">
                      {message.status !== "read" ? <button type="button" className="btn s" disabled={busy === `msg-${message.id}`} onClick={() => setMessageStatus(message, "read")}>Mark read</button> : null}
                      {message.status !== "archived" ? <button type="button" className="btn s" disabled={busy === `msg-${message.id}`} onClick={() => setMessageStatus(message, "archived")}>Archive</button> : null}
                      <a className="btn s" href={`mailto:${message.email}?subject=${encodeURIComponent(`Re: ${message.subject || "Your AgriMart message"}`)}`}>Reply by email</a>
                      <button type="button" className="lnk" disabled={busy === `del-${message.id}`} onClick={() => deleteMessage(message)}>Delete</button>
                    </div>
                  </article>
                )) : <p className="empty">No messages from the contact form yet.</p>}
              </section>
            </>
          ) : null}
        </div>
      </div>
    </RoleGate>
  );
}
