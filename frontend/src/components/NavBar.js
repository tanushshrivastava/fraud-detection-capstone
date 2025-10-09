import React from "react";
import "../styles/nav.css";

// Simple pill-style navigation that highlights the active page.

function NavBar({ items, activeItem, onSelect }) {
  return (
    <nav className="nav-links">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`nav-button ${activeItem === item.id ? "active" : ""}`}
          onClick={() => onSelect(item.id)}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}

export default NavBar;
