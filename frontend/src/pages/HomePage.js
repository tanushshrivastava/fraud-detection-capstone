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

// Interactive transaction builder that lets users craft and send payloads to the API.

const presetButtons = [
  { id: "blank", label: "Start Blank", builder: () => toFormState() },
  { id: "test", label: "Load Test JSON", builder: () => toFormState(TEST_TRANSACTION) },
];

function HomePage({ apiUrl }) {
  const [formData, setFormData] = useState(() => toFormState());
  const [activePreset, setActivePreset] = useState("blank");
  const [rawJson, setRawJson] = useState("");
  const [formMessage, setFormMessage] = useState(null);
  const [responseState, setResponseState] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dialogMessage, setDialogMessage] = useState(null);
  const [accountForm, setAccountForm] = useState({
    name: "",
    address: "",
    needs: "",
    password: "",
  });
  const [loginForm, setLoginForm] = useState({ accountId: "", password: "" });
  const [accountMessage, setAccountMessage] = useState(null);
  const [loggedInAccount, setLoggedInAccount] = useState(null);
  const [isAccountBusy, setIsAccountBusy] = useState(false);

  // Transform string form values into the types expected by the backend before submission.
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

  const apiBase = useMemo(() => (apiUrl ? apiUrl.replace(/\/$/, "") : ""), [apiUrl]);
  const buildEndpoint = (path) => `${apiBase}${path}`;
  const overlayVisible = isSubmitting || isAccountBusy;
  const overlayText = isSubmitting
    ? "Sending transaction…"
    : "Working on your request…";

  // Replace the current form contents with a preset selection.
  const applyPreset = (id, builder) => {
    setFormData(builder());
    setActivePreset(id);
    setFormMessage(null);
    setResponseState(null);
  };

  const handleFieldChange = (key, newValue) => {
    setFormData((prev) => ({
      ...prev,
      [key]: newValue,
    }));
    setActivePreset("custom");
  };

  const importRawJson = () => {
    try {
      const parsed = JSON.parse(rawJson);
      setFormData(toFormState(parsed));
      setActivePreset("custom");
      setFormMessage({ type: "success", text: "JSON imported successfully." });
    } catch (error) {
      setFormMessage({
        type: "error",
        text: "Unable to parse JSON. Please check the format.",
      });
    }
  };

  const handleAccountFieldChange = (key, newValue) => {
    setAccountForm((prev) => ({
      ...prev,
      [key]: newValue,
    }));
  };

  const handleLoginFieldChange = (key, newValue) => {
    setLoginForm((prev) => ({
      ...prev,
      [key]: newValue,
    }));
  };

  const ensureApiConfigured = (setter) => {
    if (!apiBase) {
      setter({
        type: "error",
        text: "API URL not configured. Set REACT_APP_API_URL or REACT_APP_API_ID/REACT_APP_API_REGION.",
      });
      return false;
    }
    return true;
  };

  const createAccount = async () => {
    setAccountMessage(null);
    if (!ensureApiConfigured(setAccountMessage)) {
      return;
    }
    setIsAccountBusy(true);
    try {
      const response = await axios.post(buildEndpoint("/accounts"), accountForm);
      const { accountId } = response.data;
      setLoggedInAccount({ accountId });
      setLoginForm({ accountId, password: "" });
      setAccountMessage({
        type: "success",
        text: "Account created successfully. Save your account ID to sign in later.",
        accountId,
      });
    } catch (err) {
      setAccountMessage({
        type: "error",
        text: extractErrorMessage(err),
      });
    } finally {
      setIsAccountBusy(false);
      setAccountForm((prev) => ({ ...prev, password: "" }));
    }
  };

  const loginAccount = async () => {
    setAccountMessage(null);
    if (!ensureApiConfigured(setAccountMessage)) {
      return;
    }
    setIsAccountBusy(true);
    try {
      const response = await axios.post(buildEndpoint("/login"), loginForm);
      const { accountId } = response.data;
      setLoggedInAccount({ accountId });
      setAccountMessage({
        type: "success",
        text: "Login successful. You can now submit transactions.",
      });
    } catch (err) {
      setAccountMessage({
        type: "error",
        text: extractErrorMessage(err),
      });
    } finally {
      setIsAccountBusy(false);
      setLoginForm((prev) => ({ ...prev, password: "" }));
    }
  };

  const logout = () => {
    setLoggedInAccount(null);
    setAccountMessage({
      type: "success",
      text: "Signed out successfully.",
    });
  };

  // Submit the prepared transaction to the configured API Gateway endpoint.
  const sendTransaction = async () => {
    setFormMessage(null);
    setResponseState(null);
    setDialogMessage(null);

    if (!ensureApiConfigured(setFormMessage)) {
      return;
    }

    if (!loggedInAccount) {
      setFormMessage({
        type: "error",
        text: "Log in with an account before sending a transaction.",
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
      setResponseState({ type: "success", payload: response.data });
    } catch (err) {
      const message = extractErrorMessage(err);
      setResponseState({ type: "error", message });
      setDialogMessage("Failed to send transaction. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <LoadingOverlay visible={overlayVisible} text={overlayText} />
      <DialogMessage
        title="Request Failed"
        message={dialogMessage}
        onDismiss={() => setDialogMessage(null)}
      />

      <main className="content-grid">
        <section className="card">
          <div className="card-header">
            <h2>Account Access</h2>
            {loggedInAccount && (
              <div className="account-status-row">
                <div className="account-id-chip">
                  <span>Account ID</span>
                  <code>{loggedInAccount.accountId}</code>
                </div>
                <button type="button" className="pill-button" onClick={logout}>
                  Sign Out
                </button>
              </div>
            )}
          </div>

          <div className="account-sections">
            <div className="account-section">
              <h3>Create Account</h3>
              <p className="account-subtext">
                Provide your details to generate a new account ID you can use with the demo.
              </p>
              <div className="form-grid">
                <label className="form-field">
                  <span>Name</span>
                  <input
                    type="text"
                    value={accountForm.name}
                    onChange={(event) => handleAccountFieldChange("name", event.target.value)}
                  />
                </label>
                <label className="form-field">
                  <span>Address</span>
                  <input
                    type="text"
                    value={accountForm.address}
                    onChange={(event) => handleAccountFieldChange("address", event.target.value)}
                  />
                </label>
                <label className="form-field">
                  <span>Needs</span>
                  <input
                    type="text"
                    value={accountForm.needs}
                    onChange={(event) => handleAccountFieldChange("needs", event.target.value)}
                  />
                </label>
                <label className="form-field">
                  <span>Password</span>
                  <input
                    type="password"
                    value={accountForm.password}
                    onChange={(event) => handleAccountFieldChange("password", event.target.value)}
                  />
                </label>
              </div>
              <div className="cta-row">
                <button
                  type="button"
                  className="primary-button"
                  onClick={createAccount}
                  disabled={isAccountBusy}
                >
                  {isAccountBusy ? "Creating…" : "Create Account"}
                </button>
              </div>
            </div>

            <div className="account-section">
              <h3>Sign In</h3>
              <p className="account-subtext">
                Enter your account ID and password to unlock transaction submissions.
              </p>
              <div className="form-grid">
                <label className="form-field">
                  <span>Account ID</span>
                  <input
                    type="text"
                    value={loginForm.accountId}
                    onChange={(event) => handleLoginFieldChange("accountId", event.target.value)}
                  />
                </label>
                <label className="form-field">
                  <span>Password</span>
                  <input
                    type="password"
                    value={loginForm.password}
                    onChange={(event) => handleLoginFieldChange("password", event.target.value)}
                  />
                </label>
              </div>
              <div className="cta-row">
                <button
                  type="button"
                  className="primary-button"
                  onClick={loginAccount}
                  disabled={isAccountBusy}
                >
                  {isAccountBusy ? "Signing In…" : "Sign In"}
                </button>
              </div>
            </div>
          </div>

          {accountMessage && (
            <StatusBanner variant={accountMessage.type}>
              <p>{accountMessage.text}</p>
              {accountMessage.accountId && <p>Your account ID: <code>{accountMessage.accountId}</code></p>}
            </StatusBanner>
          )}
        </section>

        <section className="card">
          <div className="card-header">
            <h2>Transaction Builder</h2>
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

          <div className="form-grid">
            {fieldConfig.map(({ key, label, inputType, step }) => (
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

          <div className="cta-row">
            <button
              type="button"
              className="primary-button"
              onClick={sendTransaction}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Sending…" : "Send Transaction"}
            </button>
          </div>
        </section>

        <section className="card">
          <div className="card-header">
            <h2>JSON Preview</h2>
          </div>
          <pre className="json-preview">{previewJson}</pre>

          <div className="json-import">
            <textarea
              placeholder="Paste JSON here to load it into the form."
              value={rawJson}
              onChange={(event) => setRawJson(event.target.value)}
            />
            <button type="button" onClick={importRawJson}>
              Import JSON
            </button>
          </div>

          {formMessage && (
            <StatusBanner variant={formMessage.type}>
              <p>{formMessage.text}</p>
            </StatusBanner>
          )}

          {responseState && responseState.type === "success" && (
            <StatusBanner variant="success" title="Response">
              <pre>{JSON.stringify(responseState.payload, null, 2)}</pre>
            </StatusBanner>
          )}

          {responseState && responseState.type === "error" && (
            <StatusBanner variant="error" title="Request Error">
              <p>{responseState.message}</p>
            </StatusBanner>
          )}
        </section>
      </main>
    </>
  );
}

export default HomePage;
