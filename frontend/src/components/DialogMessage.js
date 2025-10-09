import React from "react";
import "../styles/overlays.css";

// Lightweight modal overlay for surfacing critical form submission errors.

function DialogMessage({ message, onDismiss, title = "Notice" }) {
  if (!message) {
    return null;
  }

  return (
    <div className="dialog-overlay" role="alertdialog" aria-modal="true">
      <div className="dialog-panel">
        <h3>{title}</h3>
        <p>{message}</p>
        <button type="button" className="dialog-close-button" onClick={onDismiss}>
          Dismiss
        </button>
      </div>
    </div>
  );
}

export default DialogMessage;
