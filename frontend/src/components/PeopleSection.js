import React from "react";
import "../styles/team.css";

function PeopleSection({ title, people }) {
  return (
    <section className="card team-card">
      <div className="team-card-header">
        <h2>{title}</h2>
      </div>
      <div className="team-grid">
        {people.map(({ name, title: role, image }) => (
          <article key={name} className="team-member">
            <div className="team-photo">
              <img src={image} alt={name} />
            </div>
            <h3>{name}</h3>
            <p>{role}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export default PeopleSection;
