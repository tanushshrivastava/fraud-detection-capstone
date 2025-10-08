import React from "react";
import "../styles/home.css";

function StatusBanner({ variant = "info", title, children }) {
  return (
    <div className={`status-banner ${variant}`}>
      {title && <strong>{title}</strong>}
      {children}
    </div>
  );
}

export default StatusBanner;
