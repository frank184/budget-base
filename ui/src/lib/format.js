const CURRENCY_PREFIXES = {
  CAD: "CA$",
  USD: "US$",
  AUD: "AU$",
  EUR: "€",
  GBP: "£",
  JPY: "¥"
};

export function formatCurrency(value, currency = "CAD", { showCurrencyCode = true } = {}) {
  const formatter = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol"
  });

  const amount = toAmount(value);
  if (!showCurrencyCode) {
    return formatter.format(amount);
  }

  const parts = formatter.formatToParts(amount);
  const currencyIndex = parts.findIndex((part) => part.type === "currency");
  const displayCurrency = CURRENCY_PREFIXES[currency] || currency;

  if (currencyIndex === -1) {
    return `${displayCurrency}${formatter.format(amount)}`;
  }

  const withCode = parts.slice();
  withCode[currencyIndex] = { type: "currency", value: displayCurrency };
  return withCode.map((part) => part.value).join("");
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
