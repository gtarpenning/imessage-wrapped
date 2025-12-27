import { useEnhancement, PLAYFUL_INSTRUCTION } from "@/hooks/useEnhancement";

export default function StreaksSection({ streaks }) {
  const hasStreak = !!streaks?.longest_streak_days;
  const prompt = hasStreak
    ? `Your friend had a ${streaks.longest_streak_days} day messaging streak. ${PLAYFUL_INSTRUCTION}`
    : null;
  const { enhancement } = useEnhancement(prompt, hasStreak);

  if (!hasStreak) return null;

  return (
    <div className="section">
      <h2 className="section-title">🔥 Your Longest Streak</h2>
      {enhancement && (
        <p
          style={{
            marginTop: "0.5rem",
            marginBottom: "1rem",
            fontSize: "1.5rem",
            fontWeight: "500",
            opacity: 0.85,
            fontStyle: "italic",
            textAlign: "center",
            lineHeight: "1.4",
          }}
        >
          {enhancement}
        </p>
      )}
      <div style={{ textAlign: "center" }}>
        <p style={{ fontSize: "3rem", fontWeight: "bold", color: "#f59e0b" }}>
          {streaks.longest_streak_days} days
        </p>
      </div>
    </div>
  );
}
