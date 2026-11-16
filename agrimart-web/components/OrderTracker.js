import { STATUS_LABELS } from "@/lib/format";

const STEPS = [
  ["pending", "Pending"],
  ["paid", "Paid"],
  ["preparing", "Preparing"],
  ["out_for_delivery", "Out for delivery"],
  ["completed", "Completed"],
];

export default function OrderTracker({ status }) {
  if (status === "cancelled") {
    return <p className="notice bad" style={{ margin: "16px 0" }}>This order was cancelled. Stock was returned to the shelf.</p>;
  }
  const index = Math.max(0, STEPS.findIndex(([key]) => key === status));
  return (
    <ol className="tl" aria-label={`Order status: ${STATUS_LABELS[status] || status}`}>
      {STEPS.map(([key, label], position) => {
        const done = position < index;
        const now = position === index;
        return (
          <li
            key={key}
            className={`tl-step ${done ? "done" : ""} ${now ? "now" : ""}`}
            aria-current={now ? "step" : undefined}
          >
            <span>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}
