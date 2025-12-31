import ComparisonStatsCard from "./ComparisonStatsCard";

export default function ComparisonStreaksSection({
  streaks1,
  streaks2,
  year1,
  year2,
}) {
  if (!streaks1 || !streaks2) return null;

  return (
    <div className="section comparison-streaks">
      <h2 className="section-title">🔥 Streak Comparison</h2>

      <div className="stats-grid">
        <ComparisonStatsCard
          label="Longest Streak"
          value1={streaks1.longest_streak_days}
          value2={streaks2.longest_streak_days}
          year1={year1}
          year2={year2}
          suffix="days"
          higherIsBetter={true}
        />
      </div>

      {/* Streak contact comparison */}
      {streaks1.longest_streak_contact && streaks2.longest_streak_contact && (
        <div className="comparison-highlight">
          <h3>Longest Streak Contact</h3>
          <div className="comparison-row">
            <div className="comparison-item year1-item">
              <span className="year-tag">{year1}</span>
              <p className="streak-contact">{streaks1.longest_streak_contact}</p>
              <p className="streak-days">{streaks1.longest_streak_days} days</p>
            </div>
            <div className="comparison-item year2-item">
              <span className="year-tag">{year2}</span>
              <p className="streak-contact">{streaks2.longest_streak_contact}</p>
              <p className="streak-days">{streaks2.longest_streak_days} days</p>
            </div>
          </div>
        </div>
      )}

      <div className="streak-insight">
        {streaks2.longest_streak_days > streaks1.longest_streak_days ? (
          <p>
            🔥 Your longest streak improved by{" "}
            <strong>
              {streaks2.longest_streak_days - streaks1.longest_streak_days}
            </strong>{" "}
            days in {year2}!
          </p>
        ) : streaks2.longest_streak_days < streaks1.longest_streak_days ? (
          <p>
            📉 Your longest streak decreased by{" "}
            <strong>
              {streaks1.longest_streak_days - streaks2.longest_streak_days}
            </strong>{" "}
            days in {year2}
          </p>
        ) : (
          <p>
            ⚖️ Your longest streak stayed at{" "}
            <strong>{streaks1.longest_streak_days}</strong> days
          </p>
        )}
      </div>
    </div>
  );
}

