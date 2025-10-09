import React from "react";
import "../styles/overlays.css";

// Covers the UI with a spinner while asynchronous requests are in flight.

function LoadingOverlay({ visible, text }) {
  if (!visible) {
    return null;
  }

  return (
    <div className="loading-overlay" role="status" aria-live="assertive" aria-busy="true">
      <div className="loading-spinner" />
      <span className="loading-text">{text}</span>
    </div>
  );
}

export default LoadingOverlay;
