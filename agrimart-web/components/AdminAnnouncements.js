"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import DashNav from "./DashNav";
import RoleGate from "./RoleGate";
import { useToast } from "./Providers";
import { adminApi } from "@/lib/api";
import { dateTime } from "@/lib/format";

const EMPTY = { title: "", body: "", isPinned: false, publish: true };

export default function AdminAnnouncements() {
  const { push } = useToast();
  const formRef = useRef(null);
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    adminApi.announcements()
      .then((payload) => { setItems(payload.data || []); setError(""); })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  function set(key) {
    return (event) => {
      const value = event.target.type === "checkbox" ? event.target.checked : event.target.value;
      setForm((current) => ({ ...current, [key]: value }));
    };
  }

  function reset() {
    setForm(EMPTY);
    setEditingId(null);
  }

  function edit(item) {
    setEditingId(item.id);
    setForm({ title: item.title || "", body: item.body || "", isPinned: Boolean(item.isPinned), publish: Boolean(item.published) });
    setError("");
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function save(event) {
    event.preventDefault();
    setError("");
    if (!form.title.trim() || !form.body.trim()) return setError("Add a title and message.");
    setBusy("save");
    try {
      if (editingId) {
        await adminApi.updateAnnouncement(editingId, { title: form.title, body: form.body, isPinned: form.isPinned, published: form.publish });
      } else {
        await adminApi.createAnnouncement(form);
      }
      push(editingId ? "Announcement updated." : form.publish ? "Announcement published." : "Draft saved.");
      reset();
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  async function togglePublish(item) {
    setBusy(`publish-${item.id}`);
    try {
      if (item.published) await adminApi.unpublishAnnouncement(item.id);
      else await adminApi.publishAnnouncement(item.id);
      push(item.published ? "Moved back to draft." : "Announcement published.");
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  async function pin(item) {
    setBusy(`pin-${item.id}`);
    try {
      await adminApi.updateAnnouncement(item.id, { isPinned: !item.isPinned });
      push(item.isPinned ? "Pin removed." : "Announcement pinned.");
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  async function remove(item) {
    if (!window.confirm(`Delete “${item.title}”? This cannot be undone.`)) return;
    setBusy(`delete-${item.id}`);
    try {
      await adminApi.deleteAnnouncement(item.id);
      push("Announcement deleted.");
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  const published = items.filter((item) => item.published).length;

  return (
    <RoleGate roles={["admin"]}>
      <div className="dash">
        <DashNav kind="admin" />
        <div className="dmain">
          <header className="dhead">
            <div>
              <p className="eyebrow">Content</p>
              <h1>Announcements</h1>
              <p>Draft, publish and pin seasonal advisories. Published notes appear on the home page and the announcements list.</p>
            </div>
            <button type="button" className="btn" onClick={() => { reset(); formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>New announcement</button>
          </header>

          {error ? <p className="err" role="alert">{error}</p> : null}
          <div className="dstats">
            <div className="dstat"><span>All notes</span><b>{items.length}</b></div>
            <div className="dstat"><span>Published</span><b>{published}</b></div>
            <div className="dstat"><span>Drafts</span><b>{items.length - published}</b></div>
            <div className="dstat"><span>Pinned</span><b>{items.filter((item) => item.isPinned).length}</b></div>
          </div>

          {loading ? <p className="load-note">Loading announcements...</p> : null}
          {!loading && !items.length ? <p className="empty">No announcements yet. Write the first advisory below.</p> : null}

          <div className="cat-list">
            {items.map((item) => (
              <div className="cat-row" key={item.id}>
                <span>
                  <b>{item.title} {item.isPinned ? <span className="pin">Pinned</span> : null}</b>
                  <small>{item.published ? "Published" : "Draft"} · {dateTime(item.publishedAt || item.createdAt)} · {item.author?.fullName || "Admin"}</small>
                </span>
                <span className="btn-row">
                  <span className={`tag ${item.published ? "ok" : ""}`}>{item.published ? "Live" : "Draft"}</span>
                  <button type="button" className="lnk" disabled={busy === `pin-${item.id}`} onClick={() => pin(item)}>{item.isPinned ? "Unpin" : "Pin"}</button>
                  <button type="button" className="lnk" disabled={busy === `publish-${item.id}`} onClick={() => togglePublish(item)}>{item.published ? "Unpublish" : "Publish"}</button>
                  <button type="button" className="lnk" onClick={() => edit(item)}>Edit</button>
                  <button type="button" className="lnk" disabled={busy === `delete-${item.id}`} onClick={() => remove(item)}>Delete</button>
                </span>
              </div>
            ))}
          </div>

          <section className="editor" ref={formRef}>
            <h2>{editingId ? "Edit announcement" : "Write an announcement"}</h2>
            <form className="form" onSubmit={save} noValidate>
              <div className="frow">
                <label htmlFor="an-title">Title</label>
                <input id="an-title" className="fld" value={form.title} onChange={set("title")} required />
              </div>
              <div className="frow">
                <label htmlFor="an-body">Message</label>
                <textarea id="an-body" className="fld" style={{ minHeight: 200 }} value={form.body} onChange={set("body")} required />
              </div>
              <div className="f2">
                <label className="check">
                  <input type="checkbox" checked={form.isPinned} onChange={set("isPinned")} />
                  Pin to the top of the list
                </label>
                <label className="check">
                  <input type="checkbox" checked={form.publish} onChange={set("publish")} />
                  Publish immediately
                </label>
              </div>
              <div className="btn-row">
                <button type="submit" className="btn p" disabled={busy === "save"}>{busy === "save" ? "Saving..." : editingId ? "Update announcement" : "Save announcement"}</button>
                {editingId ? <button type="button" className="btn" onClick={reset}>Cancel edit</button> : null}
                <Link href="/announcements" className="link-quiet">View public list</Link>
              </div>
            </form>
          </section>
        </div>
      </div>
    </RoleGate>
  );
}
