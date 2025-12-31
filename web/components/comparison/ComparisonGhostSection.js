import ComparisonStatsCard from "./ComparisonStatsCard";

export default function ComparisonGhostSection({ ghosts1, ghosts2, year1, year2 }) {
  if (!ghosts1 || !ghosts2) return null;

  return (
    <div className="section comparison-ghosts">
      <h2 className="section-title">👻 Ghosting Trends</h2>

      <div className="stats-grid">
        <ComparisonStatsCard
          label="People You Ghosted"
          value1={ghosts1.people_you_left_hanging}
          value2={ghosts2.people_you_left_hanging}
          year1={year1}
          year2={year2}
          higherIsBetter={false}
        />
        <ComparisonStatsCard
          label="People Who Ghosted You"
          value1={ghosts1.people_who_left_you_hanging}
          value2={ghosts2.people_who_left_you_hanging}
          year1={year1}
          year2={year2}
          higherIsBetter={false}
        />
      </div>

      <div className="ghost-insight">
        {ghosts2.people_you_left_hanging < ghosts1.people_you_left_hanging ? (
          <p>
            ✅ You got better! You ghosted{" "}
            <strong>
              {ghosts1.people_you_left_hanging - ghosts2.people_you_left_hanging}
            </strong>{" "}
            fewer people in {year2}
          </p>
        ) : ghosts2.people_you_left_hanging > ghosts1.people_you_left_hanging ? (
          <p>
            ⚠️ You ghosted{" "}
            <strong>
              {ghosts2.people_you_left_hanging - ghosts1.people_you_left_hanging}
            </strong>{" "}
            more people in {year2}.... yikes.
          </p>
        ) : (
          <p>
            ⚖️ Your ghosting habits stayed the <strong>same</strong>. Consistency!
          </p>
        )}
      </div>
    </div>
  );
}

