function formatLabel(period) {
  if (!period) return "";
  const [year, month] = period.split("-");
  if (!year || !month) return period;
  return new Date(`${period}-01`).toLocaleString("default", {
    month: "short",
  });
}

export default function SentimentTrend({ sentiment }) {
  const periods = sentiment?.periods?.overall;
  if (!periods || periods.length === 0) return null;

  const sorted = [...periods].sort((a, b) => a.period.localeCompare(b.period));
  const average = sentiment?.overall?.avg_score ?? 0;
  const scale = 10;

  return (
    <div
      style={{
        marginTop: "2.5rem",
        padding: "1.75rem",
        borderRadius: "1.5rem",
        background: "linear-gradient(160deg, #111827, #0f172a)",
        boxShadow: "0 30px 60px -20px rgba(0,0,0,0.65)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: "1rem",
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: "1.4rem" }}>Monthly Mood</h3>
          <p style={{ margin: 0, opacity: 0.6 }}>
            Relative to your yearly average
          </p>
        </div>
        <p style={{ margin: 0, opacity: 0.7, fontSize: "0.9rem" }}>
          Avg Sentiment:{" "}
          <strong
            style={{
              color: average >= 0 ? "#f472b6" : "#22d3ee",
            }}
          >
            {average >= 0 ? "+" : ""}
            {average.toFixed(2)}
          </strong>
        </p>
      </div>
      <MoodTimeline data={sorted} average={average} scale={scale} />
    </div>
  );
}

function MoodTimeline({ data, average, scale }) {
  const best = [...data].sort((a, b) => b.avg_score - a.avg_score)[0];
  const worst = [...data].sort((a, b) => a.avg_score - b.avg_score)[0];

  return (
    <div
      style={{
        marginTop: "1rem",
        position: "relative",
        padding: "2rem 1rem 0.5rem",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: "1.5rem",
          right: "1.5rem",
          top: "3rem",
          height: "4px",
          borderRadius: "999px",
          background:
            "linear-gradient(90deg, rgba(139,92,246,0.5), rgba(236,72,153,0.45))",
          opacity: 0.85,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: "1.5rem",
          right: "1.5rem",
          top: "3rem",
          height: "2px",
          background: "rgba(255,255,255,0.12)",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "0",
          right: "1.5rem",
          fontSize: "0.8rem",
          opacity: 0.65,
        }}
      >
        Best: {formatLabel(best?.period)} ·{" "}
        {best?.avg_score !== undefined
          ? `${best.avg_score >= 0 ? "+" : ""}${best.avg_score.toFixed(2)}`
          : "—"}
      </div>
      <div
        style={{
          position: "absolute",
          top: "0",
          left: "1.5rem",
          fontSize: "0.8rem",
          opacity: 0.65,
        }}
      >
        Dip: {formatLabel(worst?.period)} ·{" "}
        {worst?.avg_score !== undefined
          ? `${worst.avg_score >= 0 ? "+" : ""}${worst.avg_score.toFixed(2)}`
          : "—"}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))`,
          gap: "0.5rem",
        }}
      >
        {data.map((entry) => {
          const score = entry.avg_score ?? 0;
          const deviation = (score - average) * scale;
          const size = 16 + Math.min(26, Math.abs(deviation) * 25);
          const isPositive = score >= 0;
          const bg = isPositive
            ? "radial-gradient(circle at 35% 35%, #fbcfe8, #ec4899)"
            : "radial-gradient(circle at 35% 35%, #bfdbfe, #22d3ee)";
          const shadow = isPositive
            ? "0 0 18px rgba(236,72,153,0.35)"
            : "0 0 18px rgba(34,211,238,0.3)";
          return (
            <div
              key={entry.period}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "0.4rem",
              }}
            >
              <div
                style={{
                  width: `${size}px`,
                  height: `${size}px`,
                  borderRadius: "50%",
                  background: bg,
                  boxShadow: shadow,
                  transform: "translateY(-6px)",
                }}
              />
              <span
                style={{
                  fontSize: "0.85rem",
                  opacity: 0.75,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {formatLabel(entry.period)}
              </span>
              <span
                style={{
                  fontSize: "0.75rem",
                  opacity: 0.55,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {score >= 0 ? "+" : ""}
                {score.toFixed(2)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
