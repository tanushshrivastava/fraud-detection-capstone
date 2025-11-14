import React, { useMemo, useState } from "react";
import axios from "axios";
import LoadingOverlay from "../components/LoadingOverlay";
import DialogMessage from "../components/DialogMessage";
import StatusBanner from "../components/StatusBanner";
import {
  TEST_TRANSACTION,
  fieldConfig,
  toFormState,
  coerceValue,
} from "../data/transactions";
import extractErrorMessage from "../utils/extractErrorMessage";
import "../styles/home.css";

const presetButtons = [
  { id: "blank", label: "Start Blank", builder: () => toFormState() },
  { id: "test", label: "Load Test JSON", builder: () => toFormState(TEST_TRANSACTION) },
];

const PRIMARY_FIELD_KEYS = ["merchant", "amt", "category", "city"];

const PRIMARY_FIELD_OVERRIDES = {
  merchant: { label: "Merchant Name*", placeholder: "Amazon, Walmart, etc." },
  amt: { label: "Amount ($)*", placeholder: "99.99" },
  category: { label: "Category", placeholder: "Shopping" },
  city: { label: "Location*", placeholder: "New York, NY" },
};

const createInitialAccountForm = () => ({
  username: "",
  email: "",
  address: "",
  password: "",
  phoneNumber: "",
  fraudThreshold: 0.7,
  smsOptIn: false,
  first_name: "",
  last_name: "",
  cc_num: "",
  gender: "",
  date_of_birth: "",
  job: "",
  city: "",
  state: "",
  zip: "",
  street: ""
});

const KNOWN_RISK_KEYS = [
  "score",
  "fraudScore",
  "fraud_probability",
  "fraudProbability",
  "probability",
  "risk",
  "fraud_score",
];

const findNumericScore = (value) => {
  if (value === null || value === undefined) return null;

  if (typeof value === "number") {
    return Number.isNaN(value) ? null : value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const numeric = findNumericScore(item);
      if (numeric !== null) return numeric;
    }
    return null;
  }

  if (typeof value === "object") {
    for (const key of KNOWN_RISK_KEYS) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        const numeric = findNumericScore(value[key]);
        if (numeric !== null) return numeric;
      }
    }
    for (const nestedValue of Object.values(value)) {
      const numeric = findNumericScore(nestedValue);
      if (numeric !== null) return numeric;
    }
  }

  return null;
};

const extractRiskScoreFromResponse = (payload) => {
  if (!payload) return null;
  if (payload.prediction !== undefined) {
    const numeric = findNumericScore(payload.prediction);
    if (numeric !== null) return numeric;
  }
  return findNumericScore(payload);
};

const formatCurrency = (value) => {
  if (value === null || value === undefined || value === "") return "—";
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return value;
  return numeric.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
};

const formatRiskScore = (value) => {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return Number(value).toFixed(2);
};

const getRiskLevel = (score) => {
  if (score === null || score === undefined || Number.isNaN(score)) return "unknown";
  if (score < 0.4) return "low";
  if (score < 0.8) return "medium";
  return "high";
};

const abbreviateAccountId = (accountId) => {
  if (!accountId) return "";
  if (accountId.length <= 16) return accountId;
  return `${accountId.slice(0, 6)}…${accountId.slice(-4)}`;
};

function HomePage({ apiUrl }) {
  const [formData, setFormData] = useState(() => toFormState());
  const [activePreset, setActivePreset] = useState("blank");
  const [rawJson, setRawJson] = useState("");
  const [formMessage, setFormMessage] = useState(null);
  const [responseState, setResponseState] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dialogMessage, setDialogMessage] = useState(null);

  const [accountForm, setAccountForm] = useState(() => createInitialAccountForm());
  const [loginForm, setLoginForm] = useState({ accountId: "", password: "" });
  const [accountMessage, setAccountMessage] = useState(null);
  const [loggedInAccount, setLoggedInAccount] = useState(null);
  const [isAccountBusy, setIsAccountBusy] = useState(false);

  const [notificationThreshold, setNotificationThreshold] = useState(0.8);
  const [phoneNumber, setPhoneNumber] = useState("+15551234567");
  const [settingsMessage, setSettingsMessage] = useState(null);

  const [recentTransactions, setRecentTransactions] = useState([]);
  const [showAdvancedFields, setShowAdvancedFields] = useState(false);
  const [activeAccountView, setActiveAccountView] = useState("signin");

  const preparedPayload = useMemo(() => {
    const result = {};
    Object.entries(formData).forEach(([key, value]) => {
      result[key] = coerceValue(key, value);
    });
    return result;
  }, [formData]);

  const previewJson = useMemo(
    () => JSON.stringify(preparedPayload, null, 2),
    [preparedPayload]
  );

  const fieldLookup = useMemo(() => {
    const lookup = {};
    fieldConfig.forEach((field) => {
      lookup[field.key] = field;
    });
    return lookup;
  }, []);

  const primaryFields = useMemo(
    () =>
      PRIMARY_FIELD_KEYS.map((key) => ({
        key,
        inputType: fieldLookup[key]?.inputType ?? "text",
        step: fieldLookup[key]?.step,
        label: PRIMARY_FIELD_OVERRIDES[key]?.label ?? fieldLookup[key]?.label ?? key,
        placeholder: PRIMARY_FIELD_OVERRIDES[key]?.placeholder,
      })),
    [fieldLookup]
  );

  const advancedFields = useMemo(
    () => fieldConfig.filter(({ key }) => !PRIMARY_FIELD_KEYS.includes(key)),
    []
  );

  const apiBase = useMemo(() => (apiUrl ? apiUrl.replace(/\/$/, "") : ""), [apiUrl]);
  const buildEndpoint = (path) => `${apiBase}${path}`;

  const overlayVisible = isSubmitting || isAccountBusy;
  const overlayText = isSubmitting ? "Sending transaction…" : "Working on your request…";

  const applyPreset = (id, builder) => {
    setFormData(builder());
    setActivePreset(id);
    setFormMessage(null);
    setResponseState(null);
    setShowAdvancedFields(false);
  };

  const handleFieldChange = (key, newValue) => {
    setFormData((prev) => ({ ...prev, [key]: newValue }));
    setActivePreset("custom");
  };

  const importRawJson = () => {
    try {
      const parsed = JSON.parse(rawJson);
      setFormData(toFormState(parsed));
      setActivePreset("custom");
      setShowAdvancedFields(true);
      setFormMessage({ type: "success", text: "JSON imported successfully." });
    } catch (error) {
      setFormMessage({
        type: "error",
        text: "Unable to parse JSON. Please check the format.",
      });
    }
  };

  const handleAccountFieldChange = (key, newValue) => {
    setAccountForm((prev) => ({ ...prev, [key]: newValue }));
  };

  const handleLoginFieldChange = (key, newValue) => {
    setLoginForm((prev) => ({ ...prev, [key]: newValue }));
  };

  const ensureApiConfigured = (setter) => {
    if (!apiBase) {
      setter({
        type: "error",
        text:
          "API URL not configured. Set REACT_APP_API_URL or REACT_APP_API_ID/REACT_APP_API_REGION.",
      });
      return false;
    }
    return true;
  };

  const createAccount = async () => {
    setAccountMessage(null);

    if (!accountForm.smsOptIn) {
      setAccountMessage({
        type: "error",
        text: "You must opt in to SMS notifications to create an account.",
      });
      return;
    }

    if (!ensureApiConfigured(setAccountMessage)) return;

    setIsAccountBusy(true);
    try {
      console.log("Sending account data:", accountForm);
      console.log("JSON stringified:", JSON.stringify(accountForm));
      const response = await axios.post(buildEndpoint("/accounts"), accountForm, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      const { accountId, fraudThreshold } = response.data;
      setLoggedInAccount({ accountId, fraudThreshold });
      setLoginForm({ accountId, password: "" });
      setActiveAccountView("signin");
      setAccountMessage({
        type: "success",
        text: "Account created successfully. Save your account ID to sign in later.",
        accountId,
      });
      setAccountForm(createInitialAccountForm());
    } catch (err) {
      setAccountMessage({ type: "error", text: extractErrorMessage(err) });
    } finally {
      setIsAccountBusy(false);
      setAccountForm((prev) => ({ ...prev, password: "" }));
    }
  };

  const loginAccount = async () => {
    setAccountMessage(null);
    if (!ensureApiConfigured(setAccountMessage)) return;

    setIsAccountBusy(true);
    try {
      const response = await axios.post(buildEndpoint("/login"), loginForm);
      const { accountId, fraudThreshold } = response.data;
      setLoggedInAccount({ accountId, fraudThreshold });
      setAccountMessage({
        type: "success",
        text: "Login successful. You can now submit transactions.",
      });
      setSettingsMessage(null);
      setActiveAccountView("settings");
    } catch (err) {
      setAccountMessage({ type: "error", text: extractErrorMessage(err) });
    } finally {
      setIsAccountBusy(false);
      setLoginForm((prev) => ({ ...prev, password: "" }));
    }
  };

  const logout = () => {
    setLoggedInAccount(null);
    setSettingsMessage(null);
    setAccountMessage({ type: "success", text: "Signed out successfully." });
    setActiveAccountView("signin");
  };

  const sendTransaction = async () => {
    setFormMessage(null);
    setResponseState(null);
    setDialogMessage(null);

    if (!ensureApiConfigured(setFormMessage)) return;

    if (!loggedInAccount) {
      setFormMessage({
        type: "error",
        text: "Sign in with an account before submitting a transaction.",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        accountId: loggedInAccount.accountId,
        transaction: preparedPayload,
      };
      const response = await axios.post(buildEndpoint("/transactions"), payload);
      const riskScore = extractRiskScoreFromResponse(response.data);
      const { smsSent } = response.data;
      setResponseState({
        type: "success",
        payload: response.data,
        riskScore,
        smsSent,
      });
      setRecentTransactions((prev) => {
        const entry = {
          id: Date.now().toString(),
          merchant: preparedPayload.merchant || "—",
          amount: preparedPayload.amt,
          risk: riskScore,
        };
        return [entry, ...prev].slice(0, 5);
      });
    } catch (err) {
      const message = extractErrorMessage(err);
      setResponseState({ type: "error", message });
      setDialogMessage("Failed to send transaction. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateNotificationSettings = (event) => {
    event.preventDefault();
    setSettingsMessage(null);

    if (!loggedInAccount) {
      setSettingsMessage({
        type: "error",
        text: "Sign in to update notification settings.",
      });
      return;
    }

    setSettingsMessage({
      type: "success",
      text: `We'll notify you when a transaction exceeds a risk score of ${notificationThreshold.toFixed(
        2
      )}.`,
    });
  };

  const sessionLabel = loggedInAccount
    ? abbreviateAccountId(loggedInAccount.accountId)
    : "Not signed in";

  const sliderDisabled = !loggedInAccount;

  return (
    <>
      <LoadingOverlay visible={overlayVisible} text={overlayText} />
      <DialogMessage
        title="Request Failed"
        message={dialogMessage}
        onDismiss={() => setDialogMessage(null)}
      />

      <div className="dashboard">
        <header className="dashboard-header">
          <div className="dashboard-brand">
            <span className="shield-icon" aria-hidden="true">
              <span />
            </span>
            <div>
              <h1>Capstone</h1>
              <p>Fraud detection control center</p>
            </div>
          </div>
          <div className="session-controls">
            <span className="session-label">{sessionLabel}</span>
            {loggedInAccount ? (
              <button
                type="button"
                className="ghost-button"
                onClick={logout}
                disabled={isAccountBusy}
              >
                Sign Out
              </button>
            ) : (
              <button
                type="button"
                className="ghost-button"
                onClick={() => setActiveAccountView("signin")}
              >
                Sign In
              </button>
            )}
          </div>
        </header>

        <div className="dashboard-columns">
          <div className="dashboard-main">
            {/* Submit a Transaction */}
            <section className="panel transaction-panel">
              <div className="panel-header">
                <div>
                  <h2>Submit a Transaction</h2>
                  <p>Capture merchant details and evaluate the fraud risk in real time.</p>
                </div>
                <div className="preset-row">
                  <span>Quick fill:</span>
                  {presetButtons.map((preset) => (
                    <button
                      key={preset.id}
                      className={`pill-button ${activePreset === preset.id ? "active" : ""}`}
                      type="button"
                      onClick={() => applyPreset(preset.id, preset.builder)}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="field-grid primary-field-grid">
                {primaryFields.map(({ key, label, inputType, step, placeholder }) => (
                  <label key={key} className="form-field">
                    <span>{label}</span>
                    <input
                      type={inputType}
                      step={step}
                      placeholder={placeholder}
                      value={formData[key]}
                      onChange={(event) => handleFieldChange(key, event.target.value)}
                    />
                  </label>
                ))}
              </div>

              <div className="action-row">
                <button
                  type="button"
                  className="primary-button"
                  onClick={sendTransaction}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Submitting…" : "Submit Transaction"}
                </button>
              </div>

              {formMessage && (
                <StatusBanner variant={formMessage.type}>
                  <p>{formMessage.text}</p>
                </StatusBanner>
              )}

              {responseState && responseState.type === "success" && (
                <>
                  {responseState.smsSent !== undefined && (
                    <StatusBanner
                      variant={responseState.smsSent ? "info" : "success"}
                      title={responseState.smsSent ? "SMS Alert Sent" : "No SMS Alert"}
                    >
                      {responseState.smsSent ? (
                        <p>
                          🔔 Fraud score{" "}
                          <strong>{formatRiskScore(responseState.riskScore)}</strong> exceeds your
                          threshold{" "}
                          <strong>
                            {loggedInAccount?.fraudThreshold?.toFixed(2) || "—"}
                          </strong>
                          . An SMS alert has been sent to your phone.
                        </p>
                      ) : (
                        <p>
                          ✓ Fraud score{" "}
                          <strong>{formatRiskScore(responseState.riskScore)}</strong> is below your
                          threshold{" "}
                          <strong>
                            {loggedInAccount?.fraudThreshold?.toFixed(2) || "—"}
                          </strong>
                          . No SMS alert needed.
                        </p>
                      )}
                    </StatusBanner>
                  )}
                  <StatusBanner variant="success" title="Prediction Response">
                    <p>Review the model output below.</p>
                    <pre>{JSON.stringify(responseState.payload, null, 2)}</pre>
                  </StatusBanner>
                </>
              )}

              {responseState && responseState.type === "error" && (
                <StatusBanner variant="error" title="Request Error">
                  <p>{responseState.message}</p>
                </StatusBanner>
              )}

              <button
                type="button"
                className="link-button"
                onClick={() => setShowAdvancedFields((prev) => !prev)}
              >
                {showAdvancedFields ? "Hide advanced options" : "Advanced options"}
              </button>

              {showAdvancedFields && (
                <div className="advanced-panel">
                  <h3>Complete Transaction Fields</h3>
                  <p className="advanced-description">
                    Provide additional data points to mirror the model training schema.
                  </p>
                  <div className="field-grid advanced-field-grid">
                    {advancedFields.map(({ key, label, inputType, step }) => (
                      <label key={key} className="form-field">
                        <span>{label}</span>
                        <input
                          type={inputType}
                          step={step}
                          value={formData[key]}
                          onChange={(event) => handleFieldChange(key, event.target.value)}
                        />
                      </label>
                    ))}
                  </div>
                  <div className="advanced-tools">
                    <div className="json-preview-card">
                      <div className="json-preview-header">
                        <h4>JSON Preview</h4>
                        <span>Ready to send</span>
                      </div>
                      <pre className="json-preview-block">{previewJson}</pre>
                    </div>
                    <div className="json-import-card">
                      <h4>Import JSON</h4>
                      <p>Paste a transaction payload to populate the form instantly.</p>
                      <textarea
                        placeholder="Paste JSON here to load it into the form."
                        value={rawJson}
                        onChange={(event) => setRawJson(event.target.value)}
                      />
                      <button type="button" onClick={importRawJson}>
                        Import JSON
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* Recent Transactions */}
            <section className="panel recent-panel">
              <div className="panel-header">
                <h2>Recent Transactions</h2>
                <p>Latest submissions and their predicted risk level.</p>
              </div>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Merchant</th>
                      <th>Amount</th>
                      <th>Risk</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentTransactions.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="empty-state">
                          Submit a transaction to populate this list.
                        </td>
                      </tr>
                    ) : (
                      recentTransactions.map((entry) => {
                        const riskLevel = getRiskLevel(entry.risk);
                        return (
                          <tr key={entry.id}>
                            <td>{entry.merchant || "—"}</td>
                            <td>{formatCurrency(entry.amount)}</td>
                            <td>
                              <span className={`risk-indicator ${riskLevel}`}>
                                <span className="risk-dot" />
                                {formatRiskScore(entry.risk)}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              <p className="table-footnote">
                Sample thresholds: 0.0 – 0.3 low risk, 0.4 – 0.7 medium risk, above 0.8 high risk.
              </p>
            </section>
          </div>

          {/* Sidebar */}
          <aside className="dashboard-side">
            {/* Account Settings */}
            <section className="panel settings-panel" id="account-settings">
              <div className="panel-header">
                <h2>Account Settings</h2>
                <p>Notification threshold ({notificationThreshold.toFixed(2)})</p>
              </div>

              <form className="settings-form" onSubmit={updateNotificationSettings}>
                <div className="range-wrapper">
                  <div className="range-labels">
                    <span>Low (0.0)</span>
                    <span>High (1.0)</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={notificationThreshold}
                    onChange={(event) => setNotificationThreshold(Number(event.target.value))}
                    disabled={sliderDisabled}
                  />
                </div>
                <p className="range-copy">
                  You will receive notifications for transactions with a fraud rating above your
                  selected threshold.
                </p>

                <label className="form-field compact">
                  <span>Phone Number</span>
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(event) => setPhoneNumber(event.target.value)}
                    placeholder="+15551234567"
                    disabled={sliderDisabled}
                  />
                </label>

                <div className="action-row">
                  <button type="submit" className="primary-button" disabled={sliderDisabled}>
                    Update Settings
                  </button>
                </div>
              </form>

              {settingsMessage && (
                <StatusBanner variant={settingsMessage.type}>
                  <p>{settingsMessage.text}</p>
                </StatusBanner>
              )}

              {/* Auth */}
              <div className="account-access">
                <div className="account-access-header">
                  <h3>{loggedInAccount ? "Manage Access" : "Access Your Account"}</h3>
                  <p>
                    {loggedInAccount
                      ? "Stay signed in to continue evaluating transactions."
                      : "Create an account or sign in to submit transactions."}
                  </p>
                </div>

                <div className="tab-row">
                  <button
                    type="button"
                    className={`tab-button ${activeAccountView === "signin" ? "active" : ""}`}
                    onClick={() => setActiveAccountView("signin")}
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    className={`tab-button ${activeAccountView === "signup" ? "active" : ""}`}
                    onClick={() => setActiveAccountView("signup")}
                  >
                    Create Account
                  </button>
                </div>

                {activeAccountView === "signin" ? (
                  <form
                    className="auth-form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      loginAccount();
                    }}
                  >
                    <label className="form-field compact">
                      <span>Account ID</span>
                      <input
                        type="text"
                        value={loginForm.accountId}
                        onChange={(event) => handleLoginFieldChange("accountId", event.target.value)}
                      />
                    </label>
                    <label className="form-field compact">
                      <span>Password</span>
                      <input
                        type="password"
                        value={loginForm.password}
                        onChange={(event) => handleLoginFieldChange("password", event.target.value)}
                      />
                    </label>
                    <div className="action-row">
                      <button type="submit" className="primary-button" disabled={isAccountBusy}>
                        {isAccountBusy ? "Signing In…" : "Sign In"}
                      </button>
                    </div>
                  </form>
                ) : (
                  <form
                    className="auth-form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      createAccount();
                    }}
                  >
                    <label className="form-field compact">
                      <span>Username</span>
                      <input
                        type="text"
                        value={accountForm.username}
                        onChange={(event) => handleAccountFieldChange("username", event.target.value)}
                      />
                    </label>
                    <label className="form-field compact">
                      <span>Email</span>
                      <input
                        type="email"
                        value={accountForm.email}
                        onChange={(event) => handleAccountFieldChange("email", event.target.value)}
                      />
                    </label>
                    <label className="form-field compact">
                      <span>First Name</span>
                      <input
                        type="text"
                        value={accountForm.first_name}
                        onChange={(event) => handleAccountFieldChange("first_name", event.target.value)}
                      />
                    </label>
                    <label className="form-field compact">
                      <span>Last Name</span>
                      <input
                        type="text"
                        value={accountForm.last_name}
                        onChange={(event) => handleAccountFieldChange("last_name", event.target.value)}
                      />
                    </label>
                    <label className="form-field compact">
                      <span>Credit Card Number</span>
                      <input
                        type="text"
                        value={accountForm.cc_num}
                        onChange={(event) => handleAccountFieldChange("cc_num", event.target.value)}
                        maxLength="16"
                      />
                    </label>
                    <label className="form-field compact">
                      <span>Gender (M/F)</span>
                      <input
                        type="text"
                        value={accountForm.gender}
                        onChange={(event) => handleAccountFieldChange("gender", event.target.value.toUpperCase())}
                        maxLength="1"
                      />
                    </label>
                    <label className="form-field compact">
                      <span>Date of Birth (YYYY-MM-DD)</span>
                      <input
                        type="date"
                        value={accountForm.date_of_birth}
                        onChange={(event) => handleAccountFieldChange("date_of_birth", event.target.value)}
                      />
                    </label>
                    <label className="form-field compact">
                      <span>Job/Occupation</span>
                      <input
                        type="text"
                        value={accountForm.job}
                        onChange={(event) => handleAccountFieldChange("job", event.target.value)}
                      />
                    </label>
                    <label className="form-field compact">
                      <span>Street Address</span>
                      <input
                        type="text"
                        value={accountForm.street}
                        onChange={(event) => handleAccountFieldChange("street", event.target.value)}
                      />
                    </label>
                    <label className="form-field compact">
                      <span>City</span>
                      <input
                        type="text"
                        value={accountForm.city}
                        onChange={(event) => handleAccountFieldChange("city", event.target.value)}
                      />
                    </label>
                    <label className="form-field compact">
                      <span>State</span>
                      <input
                        type="text"
                        value={accountForm.state}
                        onChange={(event) => handleAccountFieldChange("state", event.target.value.toUpperCase())}
                        maxLength="2"
                      />
                    </label>
                    <label className="form-field compact">
                      <span>ZIP Code</span>
                      <input
                        type="text"
                        value={accountForm.zip}
                        onChange={(event) => handleAccountFieldChange("zip", event.target.value)}
                        maxLength="5"
                      />
                    </label>
                    <label className="form-field compact">
                      <span>Full Mailing Address</span>
                      <input
                        type="text"
                        value={accountForm.address}
                        onChange={(event) => handleAccountFieldChange("address", event.target.value)}
                      />
                    </label>
                    <label className="form-field compact">
                      <span>Password</span>
                      <input
                        type="password"
                        value={accountForm.password}
                        onChange={(event) => handleAccountFieldChange("password", event.target.value)}
                      />
                    </label>
                    <label className="form-field compact">
                      <span>Phone Number</span>
                      <input
                        type="tel"
                        value={accountForm.phoneNumber}
                        onChange={(event) =>
                          handleAccountFieldChange("phoneNumber", event.target.value)
                        }
                        placeholder="+15551234567"
                      />
                    </label>
                    <label className="form-field compact">
                      <span>Fraud Alert Threshold: {accountForm.fraudThreshold.toFixed(2)}</span>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={accountForm.fraudThreshold}
                        onChange={(event) =>
                          handleAccountFieldChange(
                            "fraudThreshold",
                            parseFloat(event.target.value)
                          )
                        }
                      />
                    </label>
                    <p className="range-copy">
                      You will receive SMS notifications for transactions with a fraud rating above{" "}
                      {accountForm.fraudThreshold.toFixed(2)}.
                    </p>
                    <label className="checkbox-field">
                      <input
                        type="checkbox"
                        checked={accountForm.smsOptIn}
                        onChange={(event) =>
                          handleAccountFieldChange("smsOptIn", event.target.checked)
                        }
                        required
                      />
                      <span>
                        I agree to receive SMS text messages from Capstone Fraud Detection to the
                        phone number provided above. Message frequency varies based on transaction
                        activity. Message and data rates may apply. Reply STOP to opt out at any
                        time.
                      </span>
                    </label>
                    <div className="action-row">
                      <button
                        type="submit"
                        className="primary-button"
                        disabled={isAccountBusy || !accountForm.smsOptIn}
                      >
                        {isAccountBusy ? "Creating…" : "Create Account"}
                      </button>
                    </div>
                  </form>
                )}

                {accountMessage && (
                  <StatusBanner variant={accountMessage.type}>
                    <p>{accountMessage.text}</p>
                    {accountMessage.accountId && (
                      <p>
                        Your account ID: <code>{accountMessage.accountId}</code>
                      </p>
                    )}
                  </StatusBanner>
                )}
              </div>
            </section>

            {/* Info */}
            <section className="panel info-panel">
              <div className="panel-header">
                <h2>How It Works</h2>
              </div>
              <p>
                Our AI-powered fraud detection system analyzes your transactions in real time and
                assigns a risk score from 0 to 1.
              </p>
              <ul className="risk-legend">
                <li>
                  <span className="legend-dot low" />
                  0.0 – 0.3: Low risk
                </li>
                <li>
                  <span className="legend-dot medium" />
                  0.4 – 0.7: Medium risk
                </li>
                <li>
                  <span className="legend-dot high" />
                  0.8 – 1.0: High risk
                </li>
              </ul>
              <p className="info-copy">
                When a transaction exceeds your notification threshold, we'll send an alert to your
                registered phone number.
              </p>
            </section>
          </aside>
        </div>
      </div>
    </>
  );
}

export default HomePage;