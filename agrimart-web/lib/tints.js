export const TINTS = {
  seeds: "#E8F1D6",
  fertilizer: "#F4E9C4",
  pesticide: "#F4DDD2",
  feeds: "#F1E3BE",
  veterinary: "#DCEBEE",
  tools: "#E7E3DA",
  irrigation: "#D8E9F3",
};

export function tintFor(category) {
  if (!category) return "var(--zone)";
  return TINTS[category.slug] || "var(--zone)";
}
