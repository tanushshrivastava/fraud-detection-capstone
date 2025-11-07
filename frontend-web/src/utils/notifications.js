const TRANSACTION_KEYWORDS = [
  "transaction",
  "purchase",
  "payment",
  "charged",
  "charge",
  "card",
  "debit",
  "credit",
  "spent",
  "spend",
  "withdrawal",
  "transfer",
  "alert",
  "sent",
  "received"
];

const CURRENCY_SYMBOLS = ["$", "£", "€", "₹", "¥", "₱", "₦", "₨", "₩", "₪"];

const CURRENCY_CODES = [
  "USD",
  "CAD",
  "AUD",
  "GBP",
  "EUR",
  "INR",
  "JPY",
  "SGD",
  "CHF",
  "CNY",
  "HKD"
];

const CATEGORY_RULES = [
  { category: "grocery_pos", test: /grocery|supermarket|market/i },
  { category: "travel", test: /flight|airlines?|hotel|travel|uber|lyft/i },
  { category: "shopping_pos", test: /amazon|store|mall|retail|shop/i },
  { category: "gas_transport", test: /gas|fuel|station|shell|chevron/i },
  { category: "entertainment", test: /cinema|movie|theater|concert/i },
  { category: "food_dining", test: /restaurant|dining|food|cafe|coffee/i },
  { category: "misc_pos", test: /\bpos\b|purchase/i }
];

const sanitizeString = (value) => {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
};

const tryParseJson = (raw) => {
  if (typeof raw !== "string") {
    return raw;
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    return { text: raw };
  }
};

const buildKey = (payload) => {
  const parts = [
    payload?.packageName || payload?.package || payload?.appPackage || "unknown",
    payload?.key || payload?.id || payload?.notificationId,
    payload?.postTime || payload?.when || Date.now()
  ];
  return parts.filter(Boolean).join(":");
};

export const normalizeNotification = (rawPayload) => {
  if (!rawPayload) {
    return null;
  }
  const payload = tryParseJson(rawPayload);
  const source = typeof payload?.notification === "object" ? payload.notification : payload;
  const packageName =
    source?.packageName || source?.package || source?.appPackage || payload?.packageName || payload?.package;
  const title = sanitizeString(source?.title || payload?.title || "");
  const text = sanitizeString(
    source?.text ||
      source?.body ||
      source?.message ||
      source?.contentText ||
      payload?.text ||
      payload?.body ||
      payload?.message ||
      ""
  );
  const subText = sanitizeString(source?.subText || source?.bigText || payload?.subText || "");
  const key = buildKey(source);
  const timestamp = Number(source?.postTime || source?.when || payload?.postTime || Date.now());

  return {
    key,
    id: source?.id ?? source?.notificationId ?? key,
    packageName: packageName ?? "",
    appName: sanitizeString(source?.appName || payload?.appName || ""),
    title,
    text,
    subText,
    summary: [title, text].filter(Boolean).join(" • "),
    postedAt: Number.isNaN(timestamp) ? Date.now() : timestamp,
    raw: payload
  };
};

const amountPattern = new RegExp(
  `(?:(${[...CURRENCY_CODES, ...CURRENCY_SYMBOLS.map((symbol) => `\\${symbol}`)].join("|")})\\s*)?` +
    `([${CURRENCY_SYMBOLS.map((symbol) => `\\${symbol}`).join("")}])?\\s*` +
    `(\\d{1,3}(?:[\\s,]\\d{3})*(?:\\.\\d{1,2})?|\\d+(?:\\.\\d{1,2})?)`,
  "i"
);

const trailingCurrencyPattern = new RegExp(
  `(\\d{1,3}(?:[\\s,]\\d{3})*(?:\\.\\d{1,2})?|\\d+(?:\\.\\d{1,2})?)\\s*(${CURRENCY_CODES.join("|")})`,
  "i"
);

const parseCurrency = (symbolOrCode) => {
  if (!symbolOrCode) return null;
  const upper = symbolOrCode.toUpperCase();
  if (CURRENCY_CODES.includes(upper)) {
    return upper;
  }
  switch (symbolOrCode) {
    case "$":
      return "USD";
    case "£":
      return "GBP";
    case "€":
      return "EUR";
    case "₹":
      return "INR";
    case "¥":
      return "JPY";
    default:
      return null;
  }
};

const cleanAmount = (value) => {
  if (!value) return null;
  const normalized = value.replace(/[\s,]/g, "");
  const parsed = Number(normalized);
  return Number.isNaN(parsed) ? null : parsed;
};

const extractAmount = (text) => {
  if (!text) return null;
  const match = text.match(amountPattern);
  if (match) {
    const [, prefixCurrency, symbolCurrency, amountRaw] = match;
    const value = cleanAmount(amountRaw);
    const currency = parseCurrency(prefixCurrency || symbolCurrency);
    if (value !== null) {
      return { amount: value, currency };
    }
  }
  const trailingMatch = text.match(trailingCurrencyPattern);
  if (trailingMatch) {
    const [, amountRaw, code] = trailingMatch;
    const value = cleanAmount(amountRaw);
    const currency = parseCurrency(code);
    if (value !== null) {
      return { amount: value, currency };
    }
  }
  return null;
};

const extractMerchant = (text) => {
  if (!text) return null;
  const atPattern = /\b(?:at|to|with)\s+([A-Za-z0-9&'@.\- ]{3,})/i;
  const match = text.match(atPattern);
  if (match) {
    return sanitizeString(match[1]);
  }
  const merchantPattern = /merchant\s*[:\-]\s*([A-Za-z0-9&'@.\- ]{3,})/i;
  const result = text.match(merchantPattern);
  if (result) {
    return sanitizeString(result[1]);
  }
  return null;
};

const inferCategory = (text) => {
  if (!text) return "misc_pos";
  for (const rule of CATEGORY_RULES) {
    if (rule.test.test(text)) {
      return rule.category;
    }
  }
  return "misc_pos";
};

export const extractTransactionDetails = (notification) => {
  if (!notification) return null;
  const textCorpus = [notification.title, notification.text, notification.subText]
    .filter(Boolean)
    .join(" ");
  const lowerText = textCorpus.toLowerCase();
  const containsKeyword = TRANSACTION_KEYWORDS.some((keyword) =>
    lowerText.includes(keyword)
  );
  const amountInfo = extractAmount(textCorpus);

  if (!amountInfo && !containsKeyword) {
    return null;
  }

  return {
    amount: amountInfo?.amount ?? null,
    currency: amountInfo?.currency ?? null,
    merchant: extractMerchant(textCorpus),
    category: inferCategory(textCorpus),
    timestamp: notification.postedAt,
    sourcePackage: notification.packageName || "",
    rawText: textCorpus,
    isLikelyTransaction: containsKeyword
  };
};

export const isLikelyTransactionNotification = (notification) => {
  const details = extractTransactionDetails(notification);
  return Boolean(details?.isLikelyTransaction || (details?.amount ?? null) !== null);
};

export const formatNotificationTimestamp = (timestamp) => {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
};
