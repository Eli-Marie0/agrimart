"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth, useToast } from "./Providers";
import AccountNav from "./AccountNav";
import { accountApi, setToken } from "@/lib/api";

const EMPTY = {
  label: "Home",
  street: "",
  barangay: "",
  municipality: "Victoria",
  province: "Oriental Mindoro",
  latitude: "",
  longitude: "",
  isDefault: false,
};

export default function AccountView() {
  const { user, ready, refresh } = useAuth();
  const { push } = useToast();
  const router = useRouter();

  const [profile, setProfile] = useState({ fullName: "", email: "", phone: "" });
  const [addresses, setAddresses] = useState([]);
  const [addressForm, setAddressForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [passwords, setPasswords] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (ready && !user) router.replace("/login?next=/account");
  }, [ready, user, router]);

  useEffect(() => {
    if (!ready || !user) return;
    let alive = true;
    setLoading(true);
    accountApi.me()
      .then((payload) => {
        if (!alive) return;
        const me = payload.data.user;
        setProfile({ fullName: me.fullName || "", email: me.email || "", phone: me.phone || "" });
        setAddresses(payload.data.addresses || []);
        setLoading(false);
      })
      .catch((err) => { if (alive) { setError(err.message); setLoading(false); } });
    return () => { alive = false; };
  }, [ready, user]);

  if (!ready || !user) {
    return <div className="wrap pad"><p className="load-note">Loading your account...</p></div>;
  }

  async function saveProfile(event) {
    event.preventDefault();
    setError("");
    setBusy("profile");
    try {
      const payload = await accountApi.updateMe(profile);
      setProfile({
        fullName: payload.data.user.fullName || "",
        email: payload.data.user.email || "",
        phone: payload.data.user.phone || "",
      });
      await refresh();
      push("Profile saved.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  async function changePassword(event) {
    event.preventDefault();
    setError("");
    if (passwords.newPassword.length < 8) return setError("Use at least 8 characters for the new password.");
    if (passwords.newPassword !== passwords.confirm) return setError("The new passwords do not match.");
    setBusy("password");
    try {
      const payload = await accountApi.changePassword({ currentPassword: passwords.currentPassword, newPassword: passwords.newPassword });
      setToken(payload?.data?.token);
      await refresh();
      setPasswords({ currentPassword: "", newPassword: "", confirm: "" });
      push("Password changed.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  function setAddr(key) {
    return (event) => setAddressForm((current) => ({ ...current, [key]: event.target.value }));
  }

  async function saveAddress(event) {
    event.preventDefault();
    setError("");
    if (!addressForm.barangay.trim() || !addressForm.municipality.trim()) {
      return setError("Add the barangay and municipality.");
    }
    setBusy("address");
    try {
      const body = {
        ...addressForm,
        label: addressForm.label || "Home",
        latitude: addressForm.latitude || null,
        longitude: addressForm.longitude || null,
        isDefault: Boolean(addressForm.isDefault),
      };
      if (editingId) await accountApi.updateAddress(editingId, body);
      else await accountApi.createAddress(body);
      const payload = await accountApi.me();
      setAddresses(payload.data.addresses || []);
      setAddressForm(EMPTY);
      setEditingId(null);
      push(editingId ? "Address updated." : "Address saved.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  function editAddress(address) {
    setEditingId(address.id);
    setAddressForm({
      label: address.label || "",
      street: address.street || "",
      barangay: address.barangay || "",
      municipality: address.municipality || "",
      province: address.province || "Oriental Mindoro",
      latitude: address.latitude || "",
      longitude: address.longitude || "",
      isDefault: Boolean(address.isDefault),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function makeDefault(address) {
    setBusy(`default-${address.id}`);
    try {
      await accountApi.updateAddress(address.id, { ...address, isDefault: true });
      const payload = await accountApi.me();
      setAddresses(payload.data.addresses || []);
      push("Default address updated.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  async function removeAddress(address) {
    if (!window.confirm(`Delete the address in ${address.barangay}, ${address.municipality}?`)) return;
    setBusy(`delete-${address.id}`);
    try {
      await accountApi.deleteAddress(address.id);
      setAddresses((current) => current.filter((entry) => entry.id !== address.id));
      push("Address deleted.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="dash">
      <AccountNav />
      <div className="dmain">
        <header className="dhead">
          <div>
            <p className="eyebrow">Account</p>
            <h1>Profile and addresses</h1>
            <p>{user.roleName === "customer" ? "Customer account" : user.roleName === "staff" ? "Staff account" : "Administrator account"} · {user.email}</p>
          </div>
          <Link href="/account/orders" className="btn">My orders</Link>
        </header>

        {error ? <p className="err" role="alert">{error}</p> : null}
        {loading ? <p className="load-note">Loading saved details...</p> : null}

        <div className="dgrid">
          <section className="panel">
            <div className="panel-h"><h2>Your details</h2></div>
            <form className="form" onSubmit={saveProfile} noValidate>
              <div className="frow">
                <label htmlFor="p-name">Full name</label>
                <input id="p-name" className="fld" value={profile.fullName} onChange={(event) => setProfile({ ...profile, fullName: event.target.value })} required />
              </div>
              <div className="f2">
                <div className="frow">
                  <label htmlFor="p-email">Email</label>
                  <input id="p-email" className="fld" type="email" value={profile.email} onChange={(event) => setProfile({ ...profile, email: event.target.value })} required />
                </div>
                <div className="frow">
                  <label htmlFor="p-phone">Phone</label>
                  <input id="p-phone" className="fld" value={profile.phone} onChange={(event) => setProfile({ ...profile, phone: event.target.value })} />
                </div>
              </div>
              <div><button type="submit" className="btn p" disabled={busy === "profile"}>{busy === "profile" ? "Saving..." : "Save details"}</button></div>
            </form>
          </section>

          <section className="panel">
            <div className="panel-h"><h2>Change password</h2></div>
            <form className="form" onSubmit={changePassword} noValidate>
              <div className="frow">
                <label htmlFor="p-current">Current password</label>
                <input id="p-current" className="fld" type="password" autoComplete="current-password" value={passwords.currentPassword} onChange={(event) => setPasswords({ ...passwords, currentPassword: event.target.value })} required />
              </div>
              <div className="f2">
                <div className="frow">
                  <label htmlFor="p-new">New password</label>
                  <input id="p-new" className="fld" type="password" autoComplete="new-password" value={passwords.newPassword} onChange={(event) => setPasswords({ ...passwords, newPassword: event.target.value })} required />
                </div>
                <div className="frow">
                  <label htmlFor="p-confirm">Confirm new password</label>
                  <input id="p-confirm" className="fld" type="password" autoComplete="new-password" value={passwords.confirm} onChange={(event) => setPasswords({ ...passwords, confirm: event.target.value })} required />
                </div>
              </div>
              <div><button type="submit" className="btn" disabled={busy === "password"}>{busy === "password" ? "Saving..." : "Change password"}</button></div>
            </form>
          </section>
        </div>

        <section className="panel" style={{ marginTop: 40 }}>
          <div className="panel-h">
            <h2>Saved addresses</h2>
            <span className="meta">{addresses.length} of 20</span>
          </div>
          {addresses.length ? (
            <div className="cat-list">
              {addresses.map((address) => (
                <div className="cat-row" key={address.id}>
                  <span>
                    <b>{address.label || "Address"} {address.isDefault ? <span className="tag ink">Default</span> : null}</b>
                    <small>{[address.street, address.barangay, address.municipality, address.province].filter(Boolean).join(", ")}</small>
                  </span>
                  <span className="btn-row">
                    {!address.isDefault ? (
                      <button type="button" className="lnk" disabled={busy === `default-${address.id}`} onClick={() => makeDefault(address)}>Set default</button>
                    ) : null}
                    <button type="button" className="lnk" onClick={() => editAddress(address)}>Edit</button>
                    <button type="button" className="lnk" disabled={busy === `delete-${address.id}`} onClick={() => removeAddress(address)}>Delete</button>
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty">No saved addresses yet. Add one below or at checkout.</p>
          )}

          <div className="editor">
            <h2>{editingId ? "Edit address" : "Add an address"}</h2>
            <form className="form" onSubmit={saveAddress} noValidate>
              <div className="f2">
                <div className="frow">
                  <label htmlFor="a-label">Label</label>
                  <input id="a-label" className="fld" value={addressForm.label} onChange={setAddr("label")} placeholder="Home, farm, office" />
                </div>
                <div className="frow">
                  <label htmlFor="a-street">Street or sitio</label>
                  <input id="a-street" className="fld" value={addressForm.street} onChange={setAddr("street")} />
                </div>
              </div>
              <div className="f3">
                <div className="frow">
                  <label htmlFor="a-barangay">Barangay</label>
                  <input id="a-barangay" className="fld" value={addressForm.barangay} onChange={setAddr("barangay")} required />
                </div>
                <div className="frow">
                  <label htmlFor="a-municipality">Municipality</label>
                  <input id="a-municipality" className="fld" list="municipalities" value={addressForm.municipality} onChange={setAddr("municipality")} required />
                  <datalist id="municipalities">
                    {["Victoria", "Naujan", "Calapan", "Socorro", "Pinamalayan", "Bongabong", "Roxas", "Mansalay", "Bulalacao", "Puerto Galera"].map((name) => <option key={name} value={name} />)}
                  </datalist>
                </div>
                <div className="frow">
                  <label htmlFor="a-province">Province</label>
                  <input id="a-province" className="fld" value={addressForm.province} onChange={setAddr("province")} />
                </div>
              </div>
              <label className="check">
                <input type="checkbox" checked={addressForm.isDefault} onChange={(event) => setAddressForm({ ...addressForm, isDefault: event.target.checked })} />
                Use this as my default delivery address
              </label>
              <div className="btn-row">
                <button type="submit" className="btn" disabled={busy === "address"}>{busy === "address" ? "Saving..." : editingId ? "Update address" : "Save address"}</button>
                {editingId ? <button type="button" className="btn" onClick={() => { setEditingId(null); setAddressForm(EMPTY); }}>Cancel edit</button> : null}
              </div>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
