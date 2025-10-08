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

function HomePage({ apiUrl }) {
  const [formData, setFormData] = useState(() => toFormState());
  const [activePreset, setActivePreset] = useState("blank");
  const [rawJson, setRawJson] = useState("");
  const [formMessage, setFormMessage] = useState(null);
  const [responseState, setResponseState] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dialogMessage, setDialogMessage] = useState(null);

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

  const sendTransaction = async () => {
    setFormMessage(null);
    setResponseState(null);
    setDialogMessage(null);

    if (!apiUrl) {
      setFormMessage({
        type: "error",
        text: "API URL not configured. Set REACT_APP_API_URL or REACT_APP_API_ID/REACT_APP_API_REGION.",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await axios.post(apiUrl, preparedPayload);
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
      <LoadingOverlay visible={isSubmitting} text="Sending transaction…" />
      <DialogMessage
        title="Request Failed"
        message={dialogMessage}
        onDismiss={() => setDialogMessage(null)}
      />

      <main className="content-grid">
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
