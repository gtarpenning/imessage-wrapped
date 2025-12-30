import { useEnhancement, PLAYFUL_INSTRUCTION } from "@/hooks/useEnhancement";
import EnhancedText from "./EnhancedText";
import StatCard from "./StatCard";

export default function StreaksSection({ streaks, percentiles = {} }) {
  const hasStreak = !!streaks?.longest_streak_days;
  const prompt = hasStreak
    ? `You texted someone every day for ${streaks.longest_streak_days} days straight—think calendar math: each sunrise gets a gold star if you sent at least one message, and the chain snaps the first day you skip. ${PLAYFUL_INSTRUCTION}`
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
          valueStyle={{ fontSize: "3rem", color: "#f59e0b" }}
        />
      </div>
    </div>
  );
}
