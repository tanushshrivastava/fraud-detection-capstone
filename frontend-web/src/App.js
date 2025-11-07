import React, { useMemo, useState } from "react";
import axios from "axios";
import StatusBanner from "./components/StatusBanner";
import {
  transactionPresets,
  createEmptyTransactionState,
  numericTransactionFields,
} from "./utils/transactions";
import "./styles/home.css";

// Hardcoded account ID for public access
const ACCOUNT_ID = process.env.REACT_APP_ACCOUNT_ID || '546e9326-930b-46a4-ba39-2549c05837fe';

const PRIMARY_FIELD_KEYS = ["merchant", "amt", "category", "city"];

const PRIMARY_FIELD_OVERRIDES = {
  merchant: { label: "Merchant Name*", placeholder: "Amazon, Walmart, etc." },
  amt: { label: "Amount ($)*", placeholder: "99.99" },
  category: { label: "Category", placeholder: "Shopping" },
  city: { label: "Location*", placeholder: "New York, NY" },
};

const fieldConfig = [
  { key: "merchant", label: "Merchant", inputType: "text" },
  { key: "amt", label: "Amount", inputType: "number", step: "0.01" },
  { key: "category", label: "Category", inputType: "text" },
  { key: "city", label: "City", inputType: "text" },
  { key: "state", label: "State", inputType: "text" },
  { key: "trans_date_trans_time", label: "Transaction Date", inputType: "text" },
  { key: "cc_num", label: "Card Number", inputType: "text" },
  { key: "first", label: "First Name", inputType: "text" },
  { key: "last", label: "Last Name", inputType: "text" },
  { key: "gender", label: "Gender", inputType: "text" },
  { key: "street", label: "Street", inputType: "text" },
  { key: "zip", label: "ZIP", inputType: "number" },
  { key: "lat", label: "Latitude", inputType: "number", step: "0.0001" },
  { key: "long", label: "Longitude", inputType: "number", step: "0.0001" },
  { key: "city_pop", label: "City Population", inputType: "number" },
  { key: "job", label: "Job", inputType: "text" },
  { key: "dob", label: "Date of Birth", inputType: "text" },
  { key: "trans_num", label: "Transaction Number", inputType: "text" },
  { key: "unix_time", label: "Unix Time", inputType: "number" },
  { key: "merch_lat", label: "Merchant Latitude", inputType: "number", step: "0.0001" },
  { key: "merch_long", label: "Merchant Longitude", inputType: "number", step: "0.0001" },
];

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

const coerceValue = (key, value) => {
  if (numericTransactionFields.includes(key)) {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return value;
};

const presetButtons = [
  { id: "blank", label: "Start Blank", builder: () => createEmptyTransactionState() },
  ...transactionPresets.map(preset => ({
    id: preset.id,
    label: preset.label,
    builder: () => ({ ...preset.transaction })
  }))
];

function App() {
  const [formData, setFormData] = useState(() => createEmptyTransactionState());
  const [activePreset, setActivePreset] = useState("blank");
  const [formMessage, setFormMessage] = useState(null);
  const [responseState, setResponseState] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [showAdvancedFields, setShowAdvancedFields] = useState(false);
  const [notificationThreshold, setNotificationThreshold] = useState(0.7);
  const [phoneNumber, setPhoneNumber] = useState("+15551234567");
  const [smsOptIn, setSmsOptIn] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState(null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  const apiUrl = process.env.REACT_APP_API_URL || '';

  const preparedPayload = useMemo(() => {
    const result = {};
    Object.entries(formData).forEach(([key, value]) => {
      result[key] = coerceValue(key, value);
    });
    return result;
  }, [formData]);

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

  const ensureApiConfigured = (setter) => {
    if (!apiBase) {
      setter({
        type: "error",
        text: "API URL not configured. Set REACT_APP_API_URL in your .env file.",
      });
      return false;
    }
    return true;
  };

  const sendTransaction = async () => {
    setFormMessage(null);
    setResponseState(null);

    if (!smsOptIn) {
      setFormMessage({
        type: "error",
        text: "You must agree to receive SMS notifications to submit a transaction.",
      });
      return;
    }

    if (!ensureApiConfigured(setFormMessage)) return;

    setIsSubmitting(true);
    try {
      const payload = {
        accountId: ACCOUNT_ID,
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
      const message = err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to submit transaction';
      setResponseState({ type: "error", message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const saveAccountSettings = async () => {
    setSettingsMessage(null);

    if (!ensureApiConfigured(setSettingsMessage)) return;

    setIsSavingSettings(true);
    try {
      const payload = {
        accountId: ACCOUNT_ID,
        fraudThreshold: notificationThreshold,
        phoneNumber: phoneNumber,
      };
      const response = await axios.put(buildEndpoint("/accounts/settings"), payload);
      setSettingsMessage({
        type: "success",
        text: "Account settings saved successfully!",
      });

      // Update local state with confirmed values from server
      if (response.data.fraudThreshold !== undefined) {
        setNotificationThreshold(response.data.fraudThreshold);
      }
      if (response.data.phoneNumber !== undefined) {
        setPhoneNumber(response.data.phoneNumber);
      }
    } catch (err) {
      const message = err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to save settings';
      setSettingsMessage({ type: "error", text: message });
    } finally {
      setIsSavingSettings(false);
    }
  };

  return (
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
          <span className="session-label">Public Demo</span>
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

            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={smsOptIn}
                onChange={(event) => setSmsOptIn(event.target.checked)}
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
                type="button"
                className="primary-button"
                onClick={sendTransaction}
                disabled={isSubmitting || !smsOptIn}
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
                        <strong>{formatRiskScore(responseState.riskScore)}</strong> exceeds the
                        threshold. An SMS alert has been sent.
                      </p>
                    ) : (
                      <p>
                        ✓ Fraud score{" "}
                        <strong>{formatRiskScore(responseState.riskScore)}</strong> is below the
                        threshold. No SMS alert needed.
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

            <form className="settings-form">
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
                />
              </div>
              <p className="range-copy">
                Transactions with a fraud rating above your selected threshold will trigger an SMS alert.
              </p>

              <label className="form-field compact">
                <span>Phone Number</span>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(event) => setPhoneNumber(event.target.value)}
                  placeholder="+15551234567"
                />
              </label>

              <button
                type="button"
                className="primary-button"
                onClick={saveAccountSettings}
                disabled={isSavingSettings}
              >
                {isSavingSettings ? "Saving..." : "Save Settings"}
              </button>

              {settingsMessage && (
                <StatusBanner variant={settingsMessage.type}>
                  <p>{settingsMessage.text}</p>
                </StatusBanner>
              )}
            </form>
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
              Test different transaction scenarios using the quick-fill buttons above to see how
              the model evaluates risk.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}

export default App;
