export default function Stars({ value = 0, label = "" }) {
  const filled = Math.round(Number(value) || 0);
  return (
    <span className="stars" role="img" aria-label={label || `${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((step) => (
        <span key={step} className={step <= filled ? "on" : ""} aria-hidden="true">★</span>
      ))}
    </span>
  );
}
