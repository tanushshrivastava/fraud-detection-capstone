import React from "react";
import "../styles/about.css";

// Static overview describing the purpose of the capstone collaboration.

function AboutPage() {
  return (
    <main className="content-stack">
      <section className="card about-card">
        <h2>Capital One × UW–Madison</h2>
        <p>
          This capstone experience is a collaboration with Capital One to deepen AWS
          expertise while tackling real-world fraud detection challenges. Together we&apos;re
          building cloud-native patterns, ML workflows, and feedback loops that help teams
          ship trustworthy financial products.
        </p>
        <p>
          Explore the full project on GitHub:&nbsp;
          <a
            href="https://github.com/tanushshrivastava/fraud-detection-capstone"
            target="_blank"
            rel="noreferrer"
          >
            github.com/tanushshrivastava/fraud-detection-capstone
          </a>
        </p>
      </section>
      <section className="card about-card">
        <h2>Focus Areas</h2>
        <ul className="about-list">
          <li>Hands-on AWS learning with Capital One engineering practices.</li>
          <li>End-to-end fraud detection experimentation and evaluation.</li>
          <li>Product thinking that bridges user experience and ML insights.</li>
        </ul>
      </section>
    </main>
  );
}

export default AboutPage;
