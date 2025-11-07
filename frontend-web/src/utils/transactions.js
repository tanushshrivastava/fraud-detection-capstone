const transactionFieldTemplate = {
  trans_date_trans_time: "",
  cc_num: "",
  merchant: "",
  category: "",
  amt: "",
  trans_num: "",
  unix_time: "",
  first: "",
  last: "",
  gender: "",
  dob: "",
  job: "",
  city: "",
  state: "",
  zip: "",
  street: "",
  city_pop: "",
  lat: "",
  long: "",
  merch_lat: "",
  merch_long: ""
};

export const numericTransactionFields = [
  "amt",
  "unix_time",
  "city_pop",
  "lat",
  "long",
  "merch_lat",
  "merch_long"
];

export const transactionFieldNames = Object.keys(transactionFieldTemplate);

export const createEmptyTransactionState = () => ({
  ...transactionFieldTemplate
});

export const transactionPresets = [
  {
    id: "sample-entertainment",
    label: "Entertainment · $62,000.32 (High Risk)",
    transaction: {
      trans_date_trans_time: "2020-06-21 22:37:27",
      cc_num: "6564459919350820",
      merchant: "fraud_Nienow PLC",
      category: "entertainment",
      amt: "62000.32",
      trans_num: "47a9987ae81d99f7832a54b29a77bf4b",
      unix_time: "1371854247",
      first: "Douglas",
      last: "Willis",
      gender: "M",
      dob: "1958-09-10",
      job: "Public relations officer",
      city: "Benton",
      state: "WI",
      zip: "53803",
      street: "619 Jeremy Garden Apt. 681",
      city_pop: "1306",
      lat: "42.5545",
      long: "-90.3508",
      merch_lat: "42.771834000000005",
      merch_long: "-90.158365"
    }
  },
  {
    id: "sample-grocery",
    label: "Groceries · $86.22",
    transaction: {
      trans_date_trans_time: "2020-05-14 15:22:05",
      cc_num: "4895170907217407",
      merchant: "grocery_Fresh Fields Market",
      category: "grocery_pos",
      amt: "86.22",
      trans_num: "5e59d34f0b3a43ff8fb1f2b3a59d231c",
      unix_time: "1368541325",
      first: "Monica",
      last: "Lopez",
      gender: "F",
      dob: "1986-03-21",
      job: "Registered nurse",
      city: "Austin",
      state: "TX",
      zip: "73301",
      street: "1024 Barton Springs Rd",
      city_pop: "978908",
      lat: "30.2638",
      long: "-97.7463",
      merch_lat: "30.2681",
      merch_long: "-97.7407"
    }
  },
  {
    id: "sample-travel",
    label: "Travel · $1,245.50",
    transaction: {
      trans_date_trans_time: "2020-07-01 09:12:44",
      cc_num: "349108182115237",
      merchant: "travel_SkyAir",
      category: "travel",
      amt: "1245.50",
      trans_num: "b5d1b24a9a4b4e1ab8b04a7ba931e4dc",
      unix_time: "1372631564",
      first: "Michael",
      last: "Nguyen",
      gender: "M",
      dob: "1975-11-05",
      job: "Data analyst",
      city: "Seattle",
      state: "WA",
      zip: "98101",
      street: "1500 1st Ave",
      city_pop: "744955",
      lat: "47.608013",
      long: "-122.335167",
      merch_lat: "47.449888",
      merch_long: "-122.311777"
    }
  }
];

export const getTransactionPreset = (presetId) =>
  transactionPresets.find((preset) => preset.id === presetId);

const padNumber = (value) => value.toString().padStart(2, "0");

const formatDateForTransaction = (date) => {
  const year = date.getFullYear();
  const month = padNumber(date.getMonth() + 1);
  const day = padNumber(date.getDate());
  const hours = padNumber(date.getHours());
  const minutes = padNumber(date.getMinutes());
  const seconds = padNumber(date.getSeconds());
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

const convertNumericFields = (payload) => {
  const next = { ...payload };
  numericTransactionFields.forEach((field) => {
    if (next[field] !== undefined && next[field] !== null) {
      const parsed = Number(next[field]);
      next[field] = Number.isNaN(parsed) ? next[field] : parsed;
    }
  });
  return next;
};

export const createTransactionFromTemplate = (overrides = {}) => {
  const base = createEmptyTransactionState();
  const merged = { ...base, ...overrides };
  return convertNumericFields(merged);
};

export const createNotificationTransactionPayload = ({
  amount,
  merchant,
  category,
  timestamp
}) => {
  const preset = getTransactionPreset("sample-grocery") ?? transactionPresets[0];
  const template = convertNumericFields(preset.transaction);
  const createdAt = typeof timestamp === "number" ? new Date(timestamp) : new Date();
  return {
    ...template,
    amt:
      typeof amount === "number" && !Number.isNaN(amount)
        ? Number(amount.toFixed(2))
        : template.amt,
    merchant: merchant || template.merchant,
    category: category || template.category,
    trans_date_trans_time: formatDateForTransaction(createdAt),
    unix_time: Math.floor(createdAt.getTime() / 1000)
  };
};
