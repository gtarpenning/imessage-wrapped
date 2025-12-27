import StatCard from "./StatCard";
import ContactDistributionChart from "./ContactDistributionChart";

export default function ContactsSection({ contacts }) {
  if (!contacts) return null;

  return (
    <div className="section">
      <h2 className="section-title">👥 Your Top People</h2>

      {/* Top 5 contacts lists - commented out for privacy
      {contacts.top_sent_to && contacts.top_sent_to.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem', opacity: 0.8 }}>Most Messaged</h3>
          <ul className="top-contacts">
            {contacts.top_sent_to.slice(0, 5).map((contact, index) => (
              <li key={index}>
                <span>
                  <strong>#{index + 1}</strong> {contact.name}
                </span>
                <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#8b5cf6' }}>
                  {contact.count.toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {contacts.top_received_from && contacts.top_received_from.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem', opacity: 0.8 }}>Most Received From</h3>
          <ul className="top-contacts">
            {contacts.top_received_from.slice(0, 5).map((contact, index) => (
              <li key={index}>
                <span>
                  <strong>#{index + 1}</strong> {contact.name}
                </span>
                <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#ec4899' }}>
                  {contact.count.toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      */}

      <div className="stats-grid">
        {contacts.unique_contacts_messaged !== undefined && (
          <StatCard
            label="Unique Contacts Messaged"
            value={contacts.unique_contacts_messaged}
            valueStyle={{ fontSize: "2rem" }}
          />
        )}
        {contacts.unique_contacts_received_from !== undefined && (
          <StatCard
            label="Unique Contacts Received From"
            value={contacts.unique_contacts_received_from}
            valueStyle={{ fontSize: "2rem" }}
          />
        )}
      </div>

      {contacts.social_butterfly_day && contacts.social_butterfly_day.date && (
        <div style={{ marginTop: "2rem", textAlign: "center" }}>
          <p style={{ opacity: 0.8 }}>🦋 Social Butterfly Day</p>
          <p
            style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#f59e0b" }}
          >
            {contacts.social_butterfly_day.date}
          </p>
          <p style={{ opacity: 0.7 }}>
            {contacts.social_butterfly_day.unique_contacts} different people
          </p>
        </div>
      )}

      {contacts.fan_club_day && contacts.fan_club_day.date && (
        <div style={{ marginTop: "2rem", textAlign: "center" }}>
          <p style={{ opacity: 0.8 }}>⭐ Fan Club Day</p>
          <p
            style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#ec4899" }}
          >
            {contacts.fan_club_day.date}
          </p>
          <p style={{ opacity: 0.7 }}>
            {contacts.fan_club_day.unique_contacts} different people messaged
            you
          </p>
        </div>
      )}

      <ContactDistributionChart distribution={contacts.message_distribution} />
    </div>
  );
}
