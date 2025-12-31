import { useEnhancement, PLAYFUL_INSTRUCTION } from "@/hooks/useEnhancement";
import EnhancedText from "./EnhancedText";
import StatCard from "./StatCard";

function buildPercentileContext(percentile, totalWraps) {
  if (percentile === undefined || percentile === null || totalWraps <= 0) {
    return "";
  }
  return ` That's better than ${percentile}% of ${totalWraps.toLocaleString()} users.`;
}

export default function StreaksSection({ streaks, percentiles = {}, ranks = {}, metricCounts = {}, totalWraps = 0 }) {
  const hasStreak = !!streaks?.longest_streak_days;
  const streakPercentile = percentiles["streaks.longest_streak_days"];
  const percentileContext = buildPercentileContext(streakPercentile, totalWraps);
  
  const prompt = hasStreak
    ? `You texted someone every day for ${streaks.longest_streak_days} days straight—think calendar math: each sunrise gets a gold star if you sent at least one message, and the chain snaps the first day you skip.${percentileContext} ${PLAYFUL_INSTRUCTION}`
    : null;
  const { enhancement } = useEnhancement(prompt, hasStreak);

  if (!hasStreak) return null;

  return (
    <div className="section">
      <h2 className="section-title">🔥 Your Longest Streak</h2>
      {enhancement && (
        <EnhancedText style={{ marginTop: "0.5rem" }}>
          {enhancement}
        </EnhancedText>
      )}
      <div className="stats-grid" style={{ justifyContent: "center" }}>
        <StatCard
          label="Longest Streak"
          value={`${streaks.longest_streak_days} days`}
          percentile={percentiles["streaks.longest_streak_days"]}
          rank={ranks["streaks.longest_streak_days"]}
          metricTotal={metricCounts["streaks.longest_streak_days"]}
          totalWraps={totalWraps}
          valueStyle={{ fontSize: "3rem", color: "#f59e0b" }}
        />
      </div>
    </div>
  );
}
