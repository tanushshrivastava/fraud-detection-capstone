import React, { useState } from 'react';
import axios from 'axios';

// Hardcoded account ID for public access
const ACCOUNT_ID = process.env.REACT_APP_ACCOUNT_ID || 'public-demo-account';

const TEST_TRANSACTION = {
  trans_date_trans_time: '2020-06-21 22:37:27',
  cc_num: '6564459919350820',
  merchant: 'fraud_Nienow PLC',
  category: 'entertainment',
  amt: 620.33,
  first: 'Douglas',
  last: 'Willis',
  gender: 'M',
  street: '619 Jeremy Garden Apt. 681',
  city: 'Benton',
  state: 'WI',
  zip: 53803,
  lat: 42.5545,
  long: -90.3508,
  city_pop: 1306,
  job: 'Public relations officer',
  dob: '1958-09-10',
  trans_num: '47a9987ae81d99f7832a54b29a77bf4b',
  unix_time: 1371854247,
  merch_lat: 42.771834,
  merch_long: -90.158365,
};

const BLANK_TRANSACTION = {
  merchant: '',
  amt: '',
  category: '',
  city: '',
  state: '',
  trans_date_trans_time: '',
  cc_num: '',
  first: '',
  last: '',
  gender: '',
  street: '',
  zip: '',
  lat: '',
  long: '',
  city_pop: '',
  job: '',
  dob: '',
  trans_num: '',
  unix_time: '',
  merch_lat: '',
  merch_long: '',
};

function TransactionForm() {
  const [formData, setFormData] = useState({ ...BLANK_TRANSACTION });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const apiUrl = process.env.REACT_APP_API_URL || '';

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError(null);
  };

  const loadPreset = (preset) => {
    setFormData({ ...preset });
    setResult(null);
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setResult(null);

    if (!apiUrl) {
      setError('API URL not configured. Please set REACT_APP_API_URL in your .env file.');
      setIsSubmitting(false);
      return;
    }

    try {
      const payload = {
        accountId: ACCOUNT_ID,
        transaction: {
          ...formData,
          amt: parseFloat(formData.amt),
          zip: parseInt(formData.zip),
          lat: parseFloat(formData.lat),
          long: parseFloat(formData.long),
          city_pop: parseInt(formData.city_pop),
          unix_time: parseInt(formData.unix_time),
          merch_lat: parseFloat(formData.merch_lat),
          merch_long: parseFloat(formData.merch_long),
        },
      };

      const response = await axios.post(`${apiUrl}/transactions`, payload);
      setResult(response.data);
    } catch (err) {
      const errorMessage =
        err.response?.data?.error ||
        err.response?.data?.message ||
        err.message ||
        'Failed to submit transaction. Please try again.';
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getRiskLevel = (score) => {
    if (score < 0.4) return { label: 'Low Risk', className: 'risk-low' };
    if (score < 0.8) return { label: 'Medium Risk', className: 'risk-medium' };
    return { label: 'High Risk', className: 'risk-high' };
  };

  const fraudScore = result?.fraudScore ?? result?.prediction?.fraud_probability;
  const riskInfo = fraudScore !== undefined ? getRiskLevel(fraudScore) : null;

  return (
    <div className="transaction-form-container">
      <div className="preset-buttons">
        <span className="preset-label">Quick fill:</span>
        <button
          type="button"
          className="btn-preset"
          onClick={() => loadPreset(BLANK_TRANSACTION)}
        >
          Start Blank
        </button>
        <button
          type="button"
          className="btn-preset"
          onClick={() => loadPreset(TEST_TRANSACTION)}
        >
          Load Test Data
        </button>
      </div>

      <form onSubmit={handleSubmit} className="transaction-form">
        <div className="form-section">
          <h3>Primary Transaction Details</h3>
          <div className="form-grid">
            <div className="form-field">
              <label>Merchant Name *</label>
              <input
                type="text"
                value={formData.merchant}
                onChange={(e) => handleChange('merchant', e.target.value)}
                placeholder="Amazon, Walmart, etc."
                required
              />
            </div>
            <div className="form-field">
              <label>Amount ($) *</label>
              <input
                type="number"
                step="0.01"
                value={formData.amt}
                onChange={(e) => handleChange('amt', e.target.value)}
                placeholder="99.99"
                required
              />
            </div>
            <div className="form-field">
              <label>Category</label>
              <input
                type="text"
                value={formData.category}
                onChange={(e) => handleChange('category', e.target.value)}
                placeholder="shopping, dining, etc."
              />
            </div>
            <div className="form-field">
              <label>City *</label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => handleChange('city', e.target.value)}
                placeholder="New York"
                required
              />
            </div>
            <div className="form-field">
              <label>State *</label>
              <input
                type="text"
                value={formData.state}
                onChange={(e) => handleChange('state', e.target.value)}
                placeholder="NY"
                maxLength="2"
                required
              />
            </div>
          </div>
        </div>

        <button
          type="button"
          className="btn-toggle-advanced"
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          {showAdvanced ? '▼ Hide' : '▶ Show'} Advanced Fields
        </button>

        {showAdvanced && (
          <>
            <div className="form-section">
              <h3>Transaction Metadata</h3>
              <div className="form-grid">
                <div className="form-field">
                  <label>Transaction Date</label>
                  <input
                    type="text"
                    value={formData.trans_date_trans_time}
                    onChange={(e) => handleChange('trans_date_trans_time', e.target.value)}
                    placeholder="2020-06-21 22:37:27"
                  />
                </div>
                <div className="form-field">
                  <label>Transaction Number</label>
                  <input
                    type="text"
                    value={formData.trans_num}
                    onChange={(e) => handleChange('trans_num', e.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label>Unix Time</label>
                  <input
                    type="number"
                    value={formData.unix_time}
                    onChange={(e) => handleChange('unix_time', e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="form-section">
              <h3>Cardholder Information</h3>
              <div className="form-grid">
                <div className="form-field">
                  <label>Card Number</label>
                  <input
                    type="text"
                    value={formData.cc_num}
                    onChange={(e) => handleChange('cc_num', e.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label>First Name</label>
                  <input
                    type="text"
                    value={formData.first}
                    onChange={(e) => handleChange('first', e.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label>Last Name</label>
                  <input
                    type="text"
                    value={formData.last}
                    onChange={(e) => handleChange('last', e.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label>Gender</label>
                  <input
                    type="text"
                    value={formData.gender}
                    onChange={(e) => handleChange('gender', e.target.value)}
                    placeholder="M or F"
                    maxLength="1"
                  />
                </div>
                <div className="form-field">
                  <label>Date of Birth</label>
                  <input
                    type="text"
                    value={formData.dob}
                    onChange={(e) => handleChange('dob', e.target.value)}
                    placeholder="1958-09-10"
                  />
                </div>
                <div className="form-field">
                  <label>Occupation</label>
                  <input
                    type="text"
                    value={formData.job}
                    onChange={(e) => handleChange('job', e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="form-section">
              <h3>Location Details</h3>
              <div className="form-grid">
                <div className="form-field">
                  <label>Street Address</label>
                  <input
                    type="text"
                    value={formData.street}
                    onChange={(e) => handleChange('street', e.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label>ZIP Code</label>
                  <input
                    type="number"
                    value={formData.zip}
                    onChange={(e) => handleChange('zip', e.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label>City Population</label>
                  <input
                    type="number"
                    value={formData.city_pop}
                    onChange={(e) => handleChange('city_pop', e.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label>Cardholder Latitude</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={formData.lat}
                    onChange={(e) => handleChange('lat', e.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label>Cardholder Longitude</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={formData.long}
                    onChange={(e) => handleChange('long', e.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label>Merchant Latitude</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={formData.merch_lat}
                    onChange={(e) => handleChange('merch_lat', e.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label>Merchant Longitude</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={formData.merch_long}
                    onChange={(e) => handleChange('merch_long', e.target.value)}
                  />
                </div>
              </div>
            </div>
          </>
        )}

        <button type="submit" className="btn-submit" disabled={isSubmitting}>
          {isSubmitting ? 'Analyzing...' : 'Submit Transaction'}
        </button>
      </form>

      {error && (
        <div className="alert alert-error">
          <strong>Error:</strong> {error}
        </div>
      )}

      {result && (
        <div className="result-container">
          <h3>Fraud Detection Result</h3>
          {riskInfo && (
            <div className={`risk-score ${riskInfo.className}`}>
              <div className="risk-label">{riskInfo.label}</div>
              <div className="risk-value">
                Fraud Score: <strong>{fraudScore?.toFixed(4)}</strong>
              </div>
            </div>
          )}
          {result.smsSent !== undefined && (
            <div className="sms-status">
              {result.smsSent ? (
                <span className="sms-sent">📱 SMS Alert Sent</span>
              ) : (
                <span className="sms-not-sent">✓ No SMS Alert Needed</span>
              )}
            </div>
          )}
          <details className="result-details">
            <summary>View Full Response</summary>
            <pre>{JSON.stringify(result, null, 2)}</pre>
          </details>
        </div>
      )}
    </div>
  );
}

export default TransactionForm;
