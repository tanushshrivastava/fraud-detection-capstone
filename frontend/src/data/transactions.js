const TEST_TRANSACTION = {
  trans_date_trans_time: "2020-06-21 22:37:27",
  cc_num: "6564459919350820",
  merchant: "fraud_Nienow PLC",
  category: "entertainment",
  amt: 620.33,
  first: "Douglas",
  last: "Willis",
  gender: "M",
  street: "619 Jeremy Garden Apt. 681",
  city: "Benton",
  state: "WI",
  zip: 53803,
  lat: 42.5545,
  long: -90.3508,
  city_pop: 1306,
  job: "Public relations officer",
  dob: "1958-09-10",
  trans_num: "47a9987ae81d99f7832a54b29a77bf4b",
  unix_time: 1371854247,
  merch_lat: 42.771834000000005,
  merch_long: -90.158365,
};

const createEmptyTransaction = () =>
  Object.keys(TEST_TRANSACTION).reduce((acc, key) => {
    acc[key] = "";
    return acc;
  }, {});

const toFormState = (payload = {}) => {
  const base = createEmptyTransaction();
  Object.entries(payload).forEach(([key, value]) => {
    if (key in base) {
      base[key] = value === null || value === undefined ? "" : String(value);
    }
  });

  return base;
};

const coerceValue = (key, value) => {
  if (value === "" || value === null || value === undefined) {
    return value;
  }

  const reference = TEST_TRANSACTION[key];

  if (typeof reference === "number") {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? value : parsed;
  }

  return value;
};

const fieldConfig = Object.entries(TEST_TRANSACTION).map(([key, sample]) => {
  const numeric = typeof sample === "number";
  return {
    key,
    label: key.replace(/_/g, " "),
    inputType: numeric ? "number" : "text",
    step: numeric && !Number.isInteger(sample) ? "0.01" : undefined,
  };
});

export {
  TEST_TRANSACTION,
  fieldConfig,
  createEmptyTransaction,
  toFormState,
  coerceValue,
};
