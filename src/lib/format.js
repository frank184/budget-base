export function formatCurrency(value, currency = "CAD") {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency
  }).format(toAmount(value));
}

export function formatDate(value) {
  if (!value) return "No date";
  const date = new Date(`${value}T00:00:00`);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric"
  });
}

export function toAmount(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
