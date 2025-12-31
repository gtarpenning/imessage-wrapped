import ComparisonStatsCard from "./ComparisonStatsCard";

export default function ComparisonTapbacksSection({
  tapbacks1,
  tapbacks2,
  year1,
  year2,
}) {
  if (!tapbacks1 || !tapbacks2) return null;

  const tapbackEmojis = {
    love: "❤️",
    like: "👍",
    dislike: "👎",
    laugh: "😂",
    emphasize: "‼️",
    question: "❓",
  };

  return (
    <div className="section comparison-tapbacks">
      <h2 className="section-title">👍 Tapback Trends</h2>

      <div className="stats-grid">
        <ComparisonStatsCard
          label="Tapbacks Given"
          value1={tapbacks1.total_tapbacks_given}
          value2={tapbacks2.total_tapbacks_given}
          year1={year1}
          year2={year2}
          higherIsBetter={true}
        />
        <ComparisonStatsCard
          label="Tapbacks Received"
          value1={tapbacks1.total_tapbacks_received}
          value2={tapbacks2.total_tapbacks_received}
          year1={year1}
          year2={year2}
          higherIsBetter={true}
        />
      </div>

      {/* Favorite tapback comparison */}
      {tapbacks1.favorite_tapback && tapbacks2.favorite_tapback && (
        <div className="comparison-highlight">
          <h3>Your Favorite Tapback</h3>
          <div className="comparison-row">
            <div className="comparison-item year1-item">
              <span className="year-tag">{year1}</span>
              <p className="tapback-emoji">
                {tapbackEmojis[tapbacks1.favorite_tapback[0]] || "❓"}
              </p>
              <p className="tapback-name">{tapbacks1.favorite_tapback[0]}</p>
              <p className="tapback-count">{tapbacks1.favorite_tapback[1]} times</p>
            </div>
            <div className="comparison-item year2-item">
              <span className="year-tag">{year2}</span>
              <p className="tapback-emoji">
                {tapbackEmojis[tapbacks2.favorite_tapback[0]] || "❓"}
              </p>
              <p className="tapback-name">{tapbacks2.favorite_tapback[0]}</p>
              <p className="tapback-count">{tapbacks2.favorite_tapback[1]} times</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

