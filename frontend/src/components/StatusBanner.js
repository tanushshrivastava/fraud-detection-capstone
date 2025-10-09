import React from "react";
import "../styles/home.css";

// Presents success/error/info messaging with contextual styling.

function StatusBanner({ variant = "info", title, children }) {
  return (
    <div className={`status-banner ${variant}`}>
      {title && <strong>{title}</strong>}
      {children}
    </div>
  );
}

export default StatusBanner;
