"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import DashNav from "./DashNav";
import RoleGate from "./RoleGate";
import { useAuth, useToast } from "./Providers";
import { adminApi } from "@/lib/api";
import { shortDate } from "@/lib/format";

const EMPTY_USER = {
  fullName: "",
  email: "",
  phone: "",
  roleName: "staff",
  password: "",
};

const ROLE_LABELS = { customer: "Customer", staff: "Staff", admin: "Admin" };

function RoleTag({ role }) {
  const cls = role === "admin" ? "ink" : role === "staff" ? "ok" : "";
  return <span className={`tag ${cls}`}>{ROLE_LABELS[role] || role}</span>;
}

export default function AdminUsers() {
  const { push } = useToast();
  const { user: me } = useAuth();
  const formRef = useRef(null);
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(EMPTY_USER);
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const params = {};
    if (query.trim()) params.q = query.trim();
    if (role) params.role = role;
    adminApi
      .users(params)
      .then((payload) => {
        setUsers(payload.data || []);
        setError("");
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [query, role]);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(
    () => ({
      total: users.length,
      staff: users.filter((row) => row.roleName === "staff").length,
      admins: users.filter((row) => row.roleName === "admin").length,
      inactive: users.filter((row) => row.isActive === false).length,
    }),
    [users]
  );

  function set(key) {
    return (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  }

  function resetForm() {
    setForm(EMPTY_USER);
    setShowForm(false);
  }

  function openForm() {
    setForm(EMPTY_USER);
    setShowForm(true);
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  async function createUser(event) {
    event.preventDefault();
    setError("");
    if (!form.fullName.trim()) return setError("Enter the person's full name.");
    if (!form.email.trim()) return setError("Enter an email address.");
    if (form.password.length < 8) return setError("Use at least 8 characters for the password.");
    setBusy("create");
    try {
      await adminApi.createUser({
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        roleName: form.roleName,
        password: form.password,
      });
      push(`${ROLE_LABELS[form.roleName]} account created.`);
      resetForm();
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  async function changeRole(row, roleName) {
    if (row.roleName === roleName) return;
    setBusy(`role-${row.id}`);
    try {
      await adminApi.updateUser(row.id, { roleName });
      push(`${row.fullName || row.email} is now ${ROLE_LABELS[roleName].toLowerCase()}.`);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  async function toggleActive(row) {
    const next = row.isActive === false;
    if (!next && !window.confirm(`Deactivate ${row.fullName || row.email}? They will not be able to sign in.`)) return;
    setBusy(`active-${row.id}`);
    try {
      await adminApi.updateUser(row.id, { isActive: next });
      push(next ? "Account reactivated." : "Account deactivated.");
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
              <p className="eyebrow">Team and accounts</p>
              <h1>Users</h1>
              <p>Create staff and admin accounts, change roles and deactivate people who have left.</p>
            </div>
            <button type="button" className="btn" onClick={openForm}>New account</button>
          </header>

          {error ? <p className="err" role="alert">{error}</p> : null}

          <div className="dstats">
            <div className="dstat"><span>Shown</span><b>{stats.total}</b><small>matching filters</small></div>
            <div className="dstat"><span>Staff</span><b>{stats.staff}</b><small>can run the counter</small></div>
            <div className="dstat"><span>Admins</span><b>{stats.admins}</b><small>full access</small></div>
            <div className="dstat"><span>Inactive</span><b>{stats.inactive}</b><small>sign-in blocked</small></div>
          </div>

          <div className="toolbar">
            <div className="group">
              <label htmlFor="user-search" className="sr">Search users</label>
              <input
                id="user-search"
                className="fld"
                type="search"
                placeholder="Search name, email or phone"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                style={{ minWidth: 260 }}
              />
              <label htmlFor="user-role" className="sr">Filter role</label>
              <select id="user-role" className="fld" value={role} onChange={(event) => setRole(event.target.value)} style={{ minWidth: 150 }}>
                <option value="">All roles</option>
                <option value="customer">Customers</option>
                <option value="staff">Staff</option>
                <option value="admin">Admins</option>
              </select>
            </div>
            <button type="button" className="btn s" onClick={load} disabled={loading}>{loading ? "Loading..." : "Refresh"}</button>
          </div>

          <div className="tw">
            <table className="tbl">
              <thead>
                <tr><th>Person</th><th>Role</th><th>Status</th><th>Joined</th><th /></tr>
              </thead>
              <tbody>
                {users.map((row) => {
                  const self = me && String(me.id) === String(row.id);
                  return (
                    <tr key={row.id}>
                      <td>
                        <b>{row.fullName || row.username || "Unnamed account"}{self ? " (you)" : ""}</b>
                        <small className="meta" style={{ display: "block" }}>{row.email}{row.phone ? ` · ${row.phone}` : ""}</small>
                      </td>
                      <td>
                        {self ? (
                          <RoleTag role={row.roleName} />
                        ) : (
                          <select
                            className="fld"
                            aria-label={`Role for ${row.fullName || row.email}`}
                            value={row.roleName}
                            disabled={busy === `role-${row.id}`}
                            onChange={(event) => changeRole(row, event.target.value)}
                          >
                            <option value="customer">Customer</option>
                            <option value="staff">Staff</option>
                            <option value="admin">Admin</option>
                          </select>
                        )}
                      </td>
                      <td>
                        <span className={`tag ${row.isActive === false ? "out" : "ok"}`}>
                          {row.isActive === false ? "Inactive" : "Active"}
                        </span>
                      </td>
                      <td className="nowrap">{shortDate(row.createdAt)}</td>
                      <td>
                        {self ? <span className="meta">Current account</span> : (
                          <button
                            type="button"
                            className="btn s"
                            disabled={busy === `active-${row.id}`}
                            onClick={() => toggleActive(row)}
                          >
                            {busy === `active-${row.id}` ? "Saving..." : row.isActive === false ? "Reactivate" : "Deactivate"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!loading && !users.length ? <p className="empty">No accounts match those filters.</p> : null}
          </div>

          {showForm ? (
            <section className="editor" ref={formRef}>
              <h2>Create an account</h2>
              <p className="form-note">The person signs in with this email and password. Share the password securely and ask them to change it under Account.</p>
              <form className="form" onSubmit={createUser} noValidate style={{ marginTop: 16 }}>
                <div className="f2">
                  <div className="frow">
                    <label htmlFor="u-name">Full name</label>
                    <input id="u-name" className="fld" value={form.fullName} onChange={set("fullName")} required />
                  </div>
                  <div className="frow">
                    <label htmlFor="u-email">Email</label>
                    <input id="u-email" className="fld" type="email" value={form.email} onChange={set("email")} required />
                  </div>
                </div>
                <div className="f3">
                  <div className="frow">
                    <label htmlFor="u-phone">Phone (optional)</label>
                    <input id="u-phone" className="fld" value={form.phone} onChange={set("phone")} />
                  </div>
                  <div className="frow">
                    <label htmlFor="u-role">Role</label>
                    <select id="u-role" className="fld" value={form.roleName} onChange={set("roleName")}>
                      <option value="staff">Staff</option>
                      <option value="admin">Admin</option>
                      <option value="customer">Customer</option>
                    </select>
                  </div>
                  <div className="frow">
                    <label htmlFor="u-pass">Temporary password</label>
                    <input id="u-pass" className="fld" type="password" autoComplete="new-password" value={form.password} onChange={set("password")} placeholder="At least 8 characters" required />
                  </div>
                </div>
                <div className="btn-row">
                  <button type="submit" className="btn p" disabled={busy === "create"}>{busy === "create" ? "Creating..." : "Create account"}</button>
                  <button type="button" className="btn" onClick={resetForm}>Cancel</button>
                </div>
              </form>
            </section>
          ) : null}

          <p style={{ marginTop: 32 }}><Link href="/staff" className="link-quiet">Open the staff screens</Link></p>
        </div>
      </div>
    </RoleGate>
  );
}
