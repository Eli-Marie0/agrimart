import ContactForm from "@/components/ContactForm";
import { api } from "@/lib/api";

export const metadata = { title: "Contact" };

export default async function ContactPage() {
  let contact = {};
  try {
    contact = (await api("/store/content")).data?.contact || {};
  } catch {}
  const lat = Number(contact.latitude);
  const lng = Number(contact.longitude);
  const hasPoint = Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0;
  const storeLat = hasPoint ? lat : 13.177;
  const storeLng = hasPoint ? lng : 121.279;
  const mapUrl = `https://www.google.com/maps?q=${encodeURIComponent(`${storeLat},${storeLng}`)}&z=15&output=embed`;
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${storeLat},${storeLng}`)}`;

  return (
    <div className="wrap pad">
      <header className="page-h">
        <p className="eyebrow">Store locator</p>
        <h1>Contact and directions</h1>
        <p>Find us in Poblacion, Victoria. Send a message and the store team will reply during business hours.</p>
      </header>

      <div className="contact-grid">
        <div className="contact-info">
          <h2 style={{ marginTop: 0 }}>AgriMart</h2>
          <p>{contact.address || "Poblacion, Victoria, Oriental Mindoro"}</p>
          {contact.phone ? <p>Phone: {contact.phone}</p> : null}
          {contact.email ? <p>Email: <a href={`mailto:${contact.email}`}><u>{contact.email}</u></a></p> : null}

          <h2>Store hours</h2>
          <div className="hours">
            {(contact.hours || "Mon to Sat 7:00 am to 6:00 pm\nSun 7:00 am to 12:00 pm").split("\n").filter(Boolean).map((line) => (
              <div key={line}><span>{line}</span></div>
            ))}
          </div>

          <div className="map">
            <iframe title="Map to the AgriMart store" src={mapUrl} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
          </div>
          <p style={{ marginTop: 12 }}>
            <a className="btn s" href={directionsUrl} target="_blank" rel="noreferrer">Get directions</a>
          </p>
        </div>

        <div>
          <h2 className="h2">Send a message</h2>
          <ContactForm />
        </div>
      </div>
    </div>
  );
}
