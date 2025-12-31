import ComparisonStatsCard from "./ComparisonStatsCard";

export default function ComparisonContactsSection({
  contacts1,
  contacts2,
  year1,
  year2,
}) {
  if (!contacts1 || !contacts2) return null;

  return (
    <div className="section comparison-contacts">
      <h2 className="section-title">👥 Your People: Changes</h2>

      <div className="stats-grid">
        <ComparisonStatsCard
          label="Unique Contacts Messaged"
          value1={contacts1.unique_contacts_messaged}
          value2={contacts2.unique_contacts_messaged}
          year1={year1}
          year2={year2}
          higherIsBetter={true}
        />
        <ComparisonStatsCard
          label="Unique Contacts Received From"
          value1={contacts1.unique_contacts_received_from}
          value2={contacts2.unique_contacts_received_from}
          year1={year1}
          year2={year2}
          higherIsBetter={true}
        />
      </div>

      {/* Social butterfly comparison */}
      {contacts1.social_butterfly_day && contacts2.social_butterfly_day && (
        <div className="comparison-highlight">
          <h3>🦋 Social Butterfly Day</h3>
          <div className="comparison-row">
            <div className="comparison-item year1-item">
              <span className="year-tag">{year1}</span>
              <p className="highlight-date">{contacts1.social_butterfly_day.date}</p>
              <p className="highlight-detail">
                {contacts1.social_butterfly_day.unique_contacts} different people
              </p>
            </div>
            <div className="comparison-item year2-item">
              <span className="year-tag">{year2}</span>
              <p className="highlight-date">{contacts2.social_butterfly_day.date}</p>
              <p className="highlight-detail">
                {contacts2.social_butterfly_day.unique_contacts} different people
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

