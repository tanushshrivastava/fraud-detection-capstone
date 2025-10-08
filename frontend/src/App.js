import React, { useMemo, useState } from "react";
import NavBar from "./components/NavBar";
import HeroSection from "./components/HeroSection";
import Footer from "./components/Footer";
import HomePage from "./pages/HomePage";
import AboutPage from "./pages/AboutPage";
import TeamPage from "./pages/TeamPage";
import "./styles/layout.css";

const apiUrlOverride = process.env.REACT_APP_API_URL;
const apiId = process.env.REACT_APP_API_ID;
const apiRegion =
  process.env.REACT_APP_API_REGION || process.env.REACT_APP_AWS_REGION;
const apiStage = process.env.REACT_APP_API_STAGE || "prod";

const API_URL =
  apiUrlOverride ||
  (apiId && apiRegion
    ? `https://${apiId}.execute-api.${apiRegion}.amazonaws.com/${apiStage}`
    : "");

const NAV_ITEMS = [
  { id: "home", label: "Home" },
  { id: "about", label: "About" },
  { id: "team", label: "Team" },
];

const heroCopy = {
  home: {
    title: "Fraud Detection Demo",
    subtitle:
      "Craft a transaction payload, preview the JSON, and send it to your backend in one place.",
  },
  about: {
    title: "About the Collaboration",
    subtitle:
      "A Capital One × UW–Madison capstone focused on accelerating AWS innovation.",
  },
  team: {
    title: "Meet the Team",
    subtitle:
      "Builders and mentors powering the fraud detection learning journey.",
  },
};

function App() {
  const [activePage, setActivePage] = useState("home");
  const isApiConfigured = Boolean(API_URL);

  const heroContent = useMemo(() => {
    const chip = isApiConfigured ? "Connected to AWS" : "Configure API Connection";
    return {
      home: { ...heroCopy.home, chip },
      about: { ...heroCopy.about, chip: "Capital One × UW–Madison" },
      team: { ...heroCopy.team, chip: "Powered by collaboration" },
    };
  }, [isApiConfigured]);

  const renderContent = () => {
    switch (activePage) {
      case "about":
        return <AboutPage />;
      case "team":
        return <TeamPage />;
      case "home":
      default:
        return <HomePage apiUrl={API_URL} />;
    }
  };

  const selectedHero = heroContent[activePage];

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="brand-cluster">
          <span className="brand-accent" aria-hidden="true">
            <span />
          </span>
          <div>
            <div className="brand-title">Capital One × UW–Madison</div>
            <div className="brand-subtitle">Fraud Detection Capstone</div>
          </div>
        </div>
        <NavBar items={NAV_ITEMS} activeItem={activePage} onSelect={setActivePage} />
      </header>

      <HeroSection
        title={selectedHero.title}
        subtitle={selectedHero.subtitle}
        chip={selectedHero.chip}
      />

      {renderContent()}

      <Footer />
    </div>
  );
}

export default App;
