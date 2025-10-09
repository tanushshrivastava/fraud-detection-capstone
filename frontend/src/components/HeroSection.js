import React from "react";
import "../styles/layout.css";

// Displays the title/banner for the currently selected page.

function HeroSection({ title, subtitle, chip }) {
  return (
    <div className="app-header">
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <div className="connection-chip">{chip}</div>
    </div>
  );
}

export default HeroSection;
