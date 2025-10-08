import React from "react";
import "../styles/footer.css";

function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-content">
        <span>Collaboration proudly supported by Capital One and UW–Madison.</span>
        <div className="footer-logos">
          <img
            src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQwVY_xxpwAicLo_QJq_tltCXZ2RU2-StlgHg&s"
            alt="Capital One logo"
          />
          <img
            src="https://brand.wisc.edu/content/uploads/2023/09/vert-w-crest-logo-web-digital-color.png"
            alt="UW–Madison logo"
          />
        </div>
      </div>
    </footer>
  );
}

export default Footer;
