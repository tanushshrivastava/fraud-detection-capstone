import React from 'react';
import TransactionForm from './TransactionForm';
import './App.css';

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <div className="brand">
            <div className="shield-icon">
              <span className="shield-inner"></span>
            </div>
            <div>
              <h1>Fraud Detection System</h1>
              <p>Real-time transaction fraud analysis</p>
            </div>
          </div>
        </div>
      </header>

      <main className="app-main">
        <div className="container">
          <section className="intro-section">
            <h2>Test Transaction Fraud Risk</h2>
            <p>
              Submit a transaction below to get instant fraud risk assessment powered by machine learning.
              Our model analyzes multiple factors including transaction amount, location, merchant details,
              and cardholder information to predict the likelihood of fraudulent activity.
            </p>
          </section>

          <TransactionForm />

          <section className="info-section">
            <h3>How It Works</h3>
            <div className="info-grid">
              <div className="info-card">
                <div className="info-icon">📊</div>
                <h4>Data Analysis</h4>
                <p>Our model examines transaction patterns, location data, and merchant information</p>
              </div>
              <div className="info-card">
                <div className="info-icon">🤖</div>
                <h4>Machine Learning</h4>
                <p>Trained on millions of transactions to identify fraudulent patterns</p>
              </div>
              <div className="info-card">
                <div className="info-icon">⚡</div>
                <h4>Instant Results</h4>
                <p>Get real-time fraud probability scores from 0.0 (safe) to 1.0 (high risk)</p>
              </div>
            </div>
          </section>
        </div>
      </main>

      <footer className="app-footer">
        <div className="container">
          <p>&copy; 2025 Fraud Detection Capstone Project</p>
        </div>
      </footer>
    </div>
  );
}

export default App;
