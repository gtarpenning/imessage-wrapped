import StatCard from "./StatCard";

function formatWindow(minutes) {
  if (!Number.isFinite(minutes)) return "—";
  if (minutes < 1) return "<1m";
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = Math.floor(minutes / 60);
  const remaining = Math.round(minutes % 60);
  if (remaining === 0) return `${hours}h`;
  return `${hours}h ${remaining}m`;
}

function labelForScore(score) {
  if (score >= 85) return "Nuclear";
  if (score >= 70) return "Meltdown";
  if (score >= 50) return "Spiraling";
  if (score >= 30) return "Heated";
  return "Chill";
}

export default function CrashoutSection({ crashout }) {
  if (!crashout) return null;

  const minStreak = crashout.min_streak ?? 3;
  const peakStreak = crashout.peak_streak_length ?? 0;
  if (peakStreak < minStreak) return null;

  const meter = Math.max(0, Math.min(100, crashout.meter ?? 0));
  const negativeShare = Math.round((crashout.peak_negative_ratio ?? 0) * 100);

  return (
    <div className="section">
      <h2 className="section-title">💥 Crashout Meter</h2>
      <p className="section-subtitle">
        Streaks of {minStreak}+ messages you sent before a reply, weighted by negative
        tone and how compressed the streak was.
      </p>

      <div style={{ marginTop: "1rem", marginBottom: "1.5rem" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: "0.5rem",
          }}
        >
          <div style={{ fontSize: "1.1rem", fontWeight: 600 }}>
            Crashout Score
          </div>
          <div style={{ fontSize: "1.1rem", fontWeight: 600 }}>
            {meter} / 100 · {labelForScore(meter)}
          </div>
        </div>
        <div
          style={{
            position: "relative",
            height: "14px",
            borderRadius: "999px",
            background: "rgba(255, 255, 255, 0.12)",
            overflow: "hidden",
            border: "1px solid rgba(255, 255, 255, 0.12)",
          }}
        >
          <div
            style={{
              width: `${meter}%`,
              height: "100%",
              background:
                "linear-gradient(90deg, #22c55e 0%, #f59e0b 55%, #ef4444 100%)",
              transition: "width 0.6s ease",
            }}
          />
        </div>
      </div>

      <div className="stats-grid">
        <StatCard
          label="Peak Streak"
          value={`${peakStreak} msgs`}
          valueStyle={{ fontSize: "2rem" }}
        />
        <StatCard
          label="Peak Window"
          value={formatWindow(crashout.peak_streak_window_minutes)}
          valueStyle={{ fontSize: "2rem" }}
        />
        <StatCard
          label="Negative Share"
          value={`${negativeShare}%`}
          helperText="In that peak streak"
          valueStyle={{ fontSize: "2rem" }}
        />
      </div>
    </div>
  );
}
