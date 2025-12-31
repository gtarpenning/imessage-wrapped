import ComparisonStatsCard from "./ComparisonStatsCard";

export default function ComparisonHeroSection({
  year1,
  year2,
  volume1,
  volume2,
  userName,
}) {
  if (!volume1 || !volume2) return null;

  const getYearEmoji = () => {
    const emojis = ["📊", "📈", "🎯", "✨", "🔥", "💫"];
    return emojis[Math.floor(Math.random() * emojis.length)];
  };

  return (
    <div className="section hero-section comparison-hero">
      <div className="hero-content">
        <h1 className="hero-title">
          {getYearEmoji()} {userName ? `${userName}'s` : "Your"} iMessage Evolution
        </h1>
        <p className="hero-subtitle">
          Comparing <span className="year-highlight year1">{year1}</span> vs{" "}
          <span className="year-highlight year2">{year2}</span>
        </p>
      </div>

      <div className="stats-grid comparison-stats-grid">
        <ComparisonStatsCard
          label="Total Messages"
          value1={volume1.total_messages}
          value2={volume2.total_messages}
          year1={year1}
          year2={year2}
          higherIsBetter={true}
        />

        <ComparisonStatsCard
          label="Messages Sent"
          value1={volume1.total_sent}
          value2={volume2.total_sent}
          year1={year1}
          year2={year2}
          higherIsBetter={true}
        />

        <ComparisonStatsCard
          label="Messages Received"
          value1={volume1.total_received}
          value2={volume2.total_received}
          year1={year1}
          year2={year2}
          higherIsBetter={true}
        />

        <ComparisonStatsCard
          label="Active Days"
          value1={volume1.active_days}
          value2={volume2.active_days}
          year1={year1}
          year2={year2}
          higherIsBetter={true}
        />
      </div>

      <div className="comparison-insight">
        {volume2.total_messages > volume1.total_messages ? (
          <p>
            📈 You sent <strong>
              {((
                ((volume2.total_messages - volume1.total_messages) /
                  volume1.total_messages) *
                100
              ).toFixed(1))}%
            </strong> more messages in {year2}
          </p>
        ) : volume2.total_messages < volume1.total_messages ? (
          <p>
            📉 You sent <strong>
              {((
                ((volume1.total_messages - volume2.total_messages) /
                  volume1.total_messages) *
                100
              ).toFixed(1))}%
            </strong> fewer messages in {year2}
          </p>
        ) : (
          <p>
            ⚖️ You sent the <strong>same number</strong> of messages in both years!
          </p>
        )}
      </div>
    </div>
  );
}

