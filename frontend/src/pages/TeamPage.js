import React from "react";
import PeopleSection from "../components/PeopleSection";
import { devs, mentors } from "../data/team";
import "../styles/team.css";

function TeamPage() {
  return (
    <main className="content-stack">
      <PeopleSection title="Developers" people={devs} />
      <PeopleSection title="Mentors" people={mentors} />
    </main>
  );
}

export default TeamPage;
