"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth, useToast } from "@/components/Providers";
import MapPicker from "@/components/MapPicker";
import { useCart } from "@/lib/cart";
import { accountApi, checkoutApi, publicApi } from "@/lib/api";
import { peso } from "@/lib/format";

const MUNICIPALITIES = [
  "Victoria", "Naujan", "Calapan", "Socorro", "Pinamalayan", "Bongabong",
  "Roxas", "Mansalay", "Bulalacao", "Puerto Galera",
];

const PAYMENTS = [
  { id: "cod", title: "Cash on delivery", note: "Pay the rider or the counter when you receive the order." },
  { id: "gcash", title: "GCash", note: "Pay through the PayMongo sandbox checkout." },
  { id: "card", title: "Card", note: "Visa or Mastercard through the PayMongo sandbox checkout." },
  { id: "grabpay", title: "GrabPay", note: "Pay with GrabPay through the PayMongo sandbox checkout." },
];

const PAYPAL_PAYMENTS = [
  { id: "cod", title: "Cash on delivery", note: "Pay the rider or the counter when you receive the order." },
  { id: "card", title: "PayPal / Card", note: "Pay with your PayPal sandbox account or a PayPal test card." },
];

const EMPTY_ADDRESS = {
  label: "Home",
  street: "",
  barangay: "",
  municipality: "Victoria",
  province: "Oriental Mindoro",
  latitude: "",
  longitude: "",
};

export default function CheckoutPage() {
  const { user, ready } = useAuth();
  const { push } = useToast();
  const router = useRouter();
  const cart = useCart();

  const [settings, setSettings] = useState(null);
  const [methods, setMethods] = useState(null);
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fulfillment, setFulfillment] = useState("delivery");
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [useNewAddress, setUseNewAddress] = useState(false);
  const [newAddress, setNewAddress] = useState(EMPTY_ADDRESS);
  const [saveAddress, setSaveAddress] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState("cod");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [locationStatus, setLocationStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const paymentOptions = methods?.mode === "paypal" ? PAYPAL_PAYMENTS : PAYMENTS;

  useEffect(() => {
    if (methods?.mode === "paypal" && !PAYPAL_PAYMENTS.some((option) => option.id === paymentMethod)) {
      setPaymentMethod("cod");
    }
  }, [methods?.mode, paymentMethod]);

  useEffect(() => {
    if (ready && !user) {
      router.replace("/login?next=/checkout");
    } else if (ready && user && user.roleName !== "customer") {
      router.replace("/forbidden");
    }
  }, [ready, user, router]);

  useEffect(() => {
    if (!ready || !user || user.roleName !== "customer") return;
    let alive = true;
    setLoading(true);
    Promise.all([
      publicApi.settings(),
      publicApi.methods().catch(() => null),
      accountApi.addresses().catch(() => ({ data: [] })),
    ]).then(([settingsPayload, methodsPayload, addressPayload]) => {
      if (!alive) return;
      setSettings(settingsPayload.data);
      setMethods(methodsPayload?.data || null);
      const list = addressPayload?.data || [];
      setAddresses(list);
      const preferred = list.find((address) => address.isDefault) || list[0];
      setSelectedAddressId(preferred ? String(preferred.id) : "");
      setUseNewAddress(!preferred);
      setLoading(false);
    }).catch((err) => {
      if (!alive) return;
      setError(err.message);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [ready, user]);

  const chosenAddress = addresses.find((address) => String(address.id) === String(selectedAddressId));
  const municipality = fulfillment === "pickup"
    ? ""
    : useNewAddress
      ? newAddress.municipality
      : chosenAddress?.municipality || "";

  const fees = settings?.deliveryFees || {};
  const threshold = Number(settings?.freeDeliveryThreshold || 0);
  const deliveryFee = useMemo(() => {
    if (fulfillment === "pickup") return 0;
    if (threshold > 0 && cart.subtotal >= threshold) return 0;
    if (municipality && fees[municipality] !== undefined) return Number(fees[municipality]);
    return Number(settings?.defaultDeliveryFee || 100);
  }, [fulfillment, cart.subtotal, municipality, fees, threshold, settings]);

  const total = cart.subtotal + deliveryFee;
  const pinLatitude = useNewAddress ? newAddress.latitude : chosenAddress?.latitude;
  const pinLongitude = useNewAddress ? newAddress.longitude : chosenAddress?.longitude;
  const hasPin = pinLatitude !== "" && pinLatitude != null && pinLongitude !== "" && pinLongitude != null;

  function setAddress(key) {
    return (event) => setNewAddress((current) => ({ ...current, [key]: event.target.value }));
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setLocationStatus("Location is not available in this browser. Enter the map coordinates below.");
      return;
    }
    setLocationStatus("Getting your location…");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setNewAddress((current) => {
          const source = !useNewAddress && chosenAddress ? chosenAddress : current;
          return {
          ...current,
          label: source.label || "Home",
          street: source.street || "",
          barangay: source.barangay || "",
          municipality: source.municipality || "Victoria",
          province: source.province || "Oriental Mindoro",
          latitude: coords.latitude.toFixed(6),
          longitude: coords.longitude.toFixed(6),
        }; });
        setUseNewAddress(true);
        setLocationStatus("Location pinned. Check the map and adjust the coordinates if needed.");
      },
      () => setLocationStatus("We could not get your location. Allow location access or enter coordinates manually."),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    );
  }

  /** Save a selected coordinate pair and copy the current address fields. */
  function applyPin(latitude, longitude) {
    setNewAddress((current) => {
      const source = !useNewAddress && chosenAddress ? chosenAddress : current;
      return {
        ...current,
        label: source.label || "Home",
        street: source.street || "",
        barangay: source.barangay || "",
        municipality: source.municipality || "Victoria",
        province: source.province || "Oriental Mindoro",
        latitude: String(latitude),
        longitude: String(longitude),
      };
    });
    setUseNewAddress(true);
    setLocationStatus("Location pinned. Confirm the coordinates before placing your order.");
  }

  async function placeOrder(event) {
    event.preventDefault();
    setError("");
    if (!cart.items.length) return setError("Your cart is empty.");
    if (fulfillment === "delivery" && useNewAddress) {
      if (!newAddress.barangay.trim() || !newAddress.municipality) {
        return setError("Add the barangay and municipality for delivery.");
      }
      const hasLatitude = newAddress.latitude !== "";
      const hasLongitude = newAddress.longitude !== "";
      if (hasLatitude !== hasLongitude) return setError("Enter both coordinates to set a delivery pin.");
      if (hasLatitude && (Number(newAddress.latitude) < -90 || Number(newAddress.latitude) > 90 || Number(newAddress.longitude) < -180 || Number(newAddress.longitude) > 180)) {
        return setError("Enter valid latitude and longitude coordinates.");
      }
    }
    if (fulfillment === "delivery" && !useNewAddress && !selectedAddressId) {
      return setError("Choose a saved delivery address.");
    }

    setBusy(true);
    let latestProducts;
    try {
      const checked = await Promise.all(cart.items.map((item) => publicApi.product(item.slug).then((payload) => payload?.data?.product || null).catch((err) => {
        if (err.status === 404) return null;
        throw err;
      })));
      latestProducts = checked.filter(Boolean);
      const missing = cart.items.filter((item, index) => !checked[index]);
      missing.forEach((item) => cart.remove(item.id));
      const changed = cart.items.some((item, index) => {
        const current = checked[index];
        return current && (Number(current.price) !== Number(item.price) || Number(current.stockQty) < Number(item.qty));
      });
      if (latestProducts.length) cart.refreshFromProducts(latestProducts);
      if (missing.length || changed) {
        setBusy(false);
        return setError("A product, price, or stock level changed. Your cart has been refreshed; review it before placing the order.");
      }
    } catch {
      setBusy(false);
      return setError("We could not confirm current prices and stock. Check your connection and try again.");
    }

    try {
      const body = {
        items: cart.items.map((item) => ({ productId: item.id, quantity: item.qty })),
        fulfillmentType: fulfillment,
        paymentMethod,
        notes,
        ...(fulfillment === "delivery"
          ? useNewAddress
            ? { address: newAddress, saveAddress }
            : { addressId: Number(selectedAddressId) }
          : {}),
      };
      const payload = await checkoutApi.create(body);
      const { order, payment } = payload.data;
      push(`Order ${order.reference} placed.`);

      if (payment.checkoutUrl) {
        window.location.assign(payment.checkoutUrl);
        return;
      }
      if (payment.mode === "simulated") {
        router.push(`/order-confirmation?order=${order.id}&payment=simulated`);
        return;
      }
      cart.clear();
      router.push(`/order-confirmation?order=${order.id}`);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  if (!ready) {
    return <div className="wrap pad"><p className="load-note">Loading checkout...</p></div>;
  }
  if (!user || user.roleName !== "customer") {
    return (
      <div className="wrap pad">
        <div className="empty">
          <h2>{user ? "Customer account required." : "Sign in to check out."}</h2>
          <p>{user ? "Staff and admin accounts can manage the store but cannot place customer orders." : "Sign in with a customer account to place the order."}</p>
          {!user ? <Link href="/login?next=/checkout" className="btn p">Sign in</Link> : null}
          <Link href="/products" className="btn">Browse supplies</Link>
        </div>
      </div>
    );
  }
  if (!cart.items.length && !busy) {
    return (
      <div className="wrap pad">
        <div className="empty">
          <h2>Your cart is empty.</h2>
          <p>Add supplies before checking out.</p>
          <Link href="/products" className="btn p">Browse supplies</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="wrap pad">
      <header className="page-h" style={{ paddingTop: 0 }}>
        <p className="eyebrow">Step 2 of 2</p>
        <h1>Checkout</h1>
        <p>Choose delivery or pickup, add the address, then pay. Your totals are recalculated on the server.</p>
      </header>

      {loading ? <p className="load-note">Loading your saved addresses...</p> : null}

      <form className="co" onSubmit={placeOrder} noValidate>
        <div>
          <section className="co-block">
            <h2>1. Delivery or pickup</h2>
            <div className="seg" role="group" aria-label="Fulfillment">
              <button type="button" aria-pressed={fulfillment === "delivery"} onClick={() => setFulfillment("delivery")}>Delivery</button>
              <button type="button" aria-pressed={fulfillment === "pickup"} onClick={() => setFulfillment("pickup")}>Store pickup</button>
            </div>

            {fulfillment === "pickup" ? (
              <div className="notice" style={{ marginTop: 16 }}>
                <p style={{ margin: 0 }}>{settings?.pickupNote || "Pick up at the counter. Bring your order number."}</p>
                <p style={{ margin: "6px 0 0" }}>Pickup is free. We will email you when the order is ready.</p>
              </div>
            ) : (
              <div style={{ marginTop: 20 }}>
                {addresses.length ? (
                  <fieldset style={{ border: 0, padding: 0, margin: "0 0 20px" }}>
                    <legend className="ft-h">Saved addresses</legend>
                    <div className="pay-grid">
                      {addresses.map((address) => (
                        <label className="pay-opt" key={address.id}>
                          <input
                            type="radio"
                            name="savedAddress"
                            checked={!useNewAddress && String(selectedAddressId) === String(address.id)}
                            onChange={() => { setUseNewAddress(false); setSelectedAddressId(String(address.id)); }}
                          />
                          <span>
                            <b>{address.label || "Address"}{address.isDefault ? " · Default" : ""}</b>
                            <small>{[address.street, address.barangay, address.municipality, address.province].filter(Boolean).join(", ")}</small>
                          </span>
                          <span className="tag">{address.municipality}</span>
                        </label>
                      ))}
                      <label className="pay-opt">
                        <input type="radio" name="savedAddress" checked={useNewAddress} onChange={() => setUseNewAddress(true)} />
                        <span><b>Use a new address</b><small>Deliver somewhere else this time.</small></span>
                        <span className="tag">New</span>
                      </label>
                    </div>
                  </fieldset>
                ) : null}

                {useNewAddress ? (
                  <div className="form">
                    <div className="f2">
                      <div className="frow">
                        <label htmlFor="a-label">Address label</label>
                        <input id="a-label" className="fld" value={newAddress.label} onChange={setAddress("label")} placeholder="Home, farm, office" />
                      </div>
                      <div className="frow">
                        <label htmlFor="a-street">Street or sitio</label>
                        <input id="a-street" className="fld" value={newAddress.street} onChange={setAddress("street")} autoComplete="address-line1" />
                      </div>
                    </div>
                    <div className="f2">
                      <div className="frow">
                        <label htmlFor="a-barangay">Barangay</label>
                        <input id="a-barangay" className="fld" value={newAddress.barangay} onChange={setAddress("barangay")} autoComplete="address-line2" required />
                      </div>
                      <div className="frow">
                        <label htmlFor="a-municipality">Municipality</label>
                        <select id="a-municipality" className="fld" value={newAddress.municipality} onChange={setAddress("municipality")} required>
                          {(Object.keys(fees).length ? Object.keys(fees) : MUNICIPALITIES).map((name) => (
                            <option key={name} value={name}>{name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="f2">
                      <div className="frow">
                        <label htmlFor="a-province">Province</label>
                        <input id="a-province" className="fld" value={newAddress.province} onChange={setAddress("province")} autoComplete="address-level1" />
                      </div>
                      <div className="frow">
                        <label htmlFor="a-landmark">Delivery note (optional)</label>
                        <input id="a-landmark" className="fld" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Landmark, gate, best time" />
                      </div>
                    </div>
                    <div className="frow">
                      <div className="btn-row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <b>Delivery location pin</b>
                          <p className="form-note" style={{ margin: "4px 0 0" }}>Use your device location or enter the delivery point coordinates.</p>
                        </div>
                        <div className="btn-row">
                          <a className="btn s" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([useNewAddress ? newAddress.barangay : chosenAddress?.barangay, municipality, "Oriental Mindoro"].filter(Boolean).join(", "))}`} target="_blank" rel="noreferrer">Find address in Google Maps</a>
                          <button type="button" className="btn s" onClick={useCurrentLocation}>Use my current location</button>
                        </div>
                      </div>
                      <div className="f2" style={{ marginTop: 12 }}>
                        <div className="frow">
                          <label htmlFor="a-latitude">Latitude</label>
                          <input id="a-latitude" className="fld" type="number" min="-90" max="90" step="any" value={newAddress.latitude} onChange={setAddress("latitude")} placeholder="e.g. 13.177000" />
                        </div>
                        <div className="frow">
                          <label htmlFor="a-longitude">Longitude</label>
                          <input id="a-longitude" className="fld" type="number" min="-180" max="180" step="any" value={newAddress.longitude} onChange={setAddress("longitude")} placeholder="e.g. 121.279000" />
                        </div>
                      </div>
                      {locationStatus ? <p className="form-note" role="status">{locationStatus}</p> : null}
                    </div>
                    <label className="check">
                      <input type="checkbox" checked={saveAddress} onChange={(event) => setSaveAddress(event.target.checked)} />
                      Save this address to my account
                    </label>
                  </div>
                ) : (
                  <div className="frow">
                    <label htmlFor="order-notes">Delivery note (optional)</label>
                    <input id="order-notes" className="fld" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Landmark, gate, best time" />
                  </div>
                )}

                <div style={{ marginTop: 16 }}>
                  <MapPicker
                    latitude={pinLatitude}
                    longitude={pinLongitude}
                    onChange={applyPin}
                    zoom={17}
                    height={280}
                    title="Delivery area map"
                    fallbackQuery={[useNewAddress ? newAddress.barangay : chosenAddress?.barangay, municipality, "Oriental Mindoro"].filter(Boolean).join(", ")}
                  />
                </div>
                <p className="form-note" style={{ marginTop: 8 }}>
                  {hasPin ? "The map is centered on your delivery pin. Check that it points to the right place." : "This map is approximate until you pin the delivery location above. The rider may call if the address needs clarification."}
                </p>
              </div>
            )}
          </section>

          <section className="co-block">
            <h2>2. Payment</h2>
            <div className="pay-grid">
              {paymentOptions.map((payment) => (
                <label className="pay-opt" key={payment.id}>
                  <input
                    type="radio"
                    name="payment"
                    value={payment.id}
                    checked={paymentMethod === payment.id}
                    disabled={payment.id !== "cod" && methods?.mode === "unavailable"}
                    onChange={() => setPaymentMethod(payment.id)}
                  />
                  <span><b>{payment.title}</b><small>{payment.note}</small></span>
                  <span className="tag">{payment.id === "cod" ? "On handover" : methods?.mode === "unavailable" ? "Unavailable" : methods?.mode === "paypal" ? "PayPal" : methods?.onlineConfigured ? "PayMongo" : "Sandbox"}</span>
                </label>
              ))}
            </div>
            {methods?.mode === "simulated" ? (
              <p className="form-note" style={{ marginTop: 10 }}>
                Online payments use the built-in sandbox simulator until a PayMongo key is configured. Order, stock and email handling are identical to a live payment.
              </p>
            ) : null}
            {methods?.mode === "paypal" ? (
              <p className="form-note" style={{ marginTop: 10 }}>
                You will be redirected to the PayPal sandbox to approve the payment, then brought back here.
              </p>
            ) : null}
            {methods?.mode === "unavailable" ? (
              <p className="form-note" style={{ marginTop: 10 }}>
                Online payments are not configured. Choose cash on delivery or contact the store.
              </p>
            ) : null}
          </section>

          {error ? <p className="err" role="alert" style={{ fontSize: 15 }}>{error}</p> : null}
        </div>

        <aside className="rcpt" aria-label="Order summary">
          <h2>Order summary</h2>
          <div className="rl"><span>Subtotal</span><span className="money">{peso(cart.subtotal)}</span></div>
          <div className="rl">
            <span>Delivery fee</span>
            <span className="money">{fulfillment === "pickup" ? "Free" : deliveryFee === 0 ? "Free" : peso(deliveryFee)}</span>
          </div>
          {fulfillment === "delivery" && threshold > 0 && cart.subtotal >= threshold ? (
            <p className="form-note" style={{ margin: 0 }}>Free delivery because the order is over {peso(threshold)}.</p>
          ) : null}
          <div className="rl"><span>Items</span><span>{cart.count}</span></div>
          <div className="rl tot"><span>Total</span><span className="price">{peso(total)}</span></div>

          <ul style={{ listStyle: "none", padding: 0, margin: "8px 0", display: "grid", gap: 8 }}>
            {cart.items.map((item) => (
              <li key={item.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13 }}>
                <span>{item.qty} × {item.name}</span>
                <span className="nowrap">{peso(item.qty * item.price)}</span>
              </li>
            ))}
          </ul>

          <button type="submit" className="btn p" disabled={busy || loading}>
            {busy ? "Placing order..." : paymentMethod === "cod" ? "Place order" : "Pay now"}
          </button>
          <p className="form-note" style={{ margin: 0 }}>
            By placing the order you agree to be contacted about delivery. Prices and stock are confirmed on the server.
          </p>
          <Link href="/cart" className="link-quiet" style={{ textAlign: "center" }}>Back to cart</Link>
        </aside>
      </form>
    </div>
  );
}
