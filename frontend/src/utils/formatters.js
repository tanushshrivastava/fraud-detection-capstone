const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD"
});

export const formatCurrency = (value) => {
  if (value === null || value === undefined || value === "") {
    return "$0.00";
  }

  const numeric = Number(value);
  if (Number.isNaN(numeric)) {
    return `$${value}`;
  }

  return currencyFormatter.format(numeric);
};

export const formatDateTime = (value) => {
  if (!value) {
    return "Unknown";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
};

export const riskLabel = (score, threshold) => {
  if (typeof score !== "number" || typeof threshold !== "number") {
    return "Unknown";
  }

  if (score >= threshold) {
    return "High Risk";
  }

  if (threshold - score <= 10) {
    return "Medium Risk";
  }

  return "Low Risk";
};
