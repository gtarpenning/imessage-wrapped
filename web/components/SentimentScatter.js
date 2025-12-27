const stageColors = {
  sent: "linear-gradient(135deg, #ec4899, #8b5cf6)",
  received: "linear-gradient(135deg, #0ea5e9, #22d3ee)",
};

const stageLabel = {
  sent: "You",
  received: "Them",
};

function normalize(value) {
  const clamped = Math.max(
    -1,
    Math.min(1, typeof value === "number" ? value : 0),
  );
  return (clamped + 1) / 2;
}

function jitter(value, idx, force = 0.02) {
  const seed = Math.sin((idx + 1) * 9283.133) * 43758.5453;
  const offset = (seed - Math.floor(seed) - 0.5) * force;
  return Math.max(0, Math.min(1, value + offset));
}

export default function SentimentScatter({ scatter }) {
  if (!scatter || !scatter.points || scatter.points.length === 0) {
    return null;
  }

  const [xAxis, yAxis] = scatter.axes || [];
  const points = scatter.points.slice(0, 400);
  const infoLines = [];
  if (scatter.limit) {
    infoLines.push(
      `≤${scatter.limit.max_messages} ${
        stageLabel[scatter.limit.stage] || "You"
      } msgs per ${scatter.limit.interval}`,
    );
  } else if (scatter.sample_rate && scatter.sample_rate < 1) {
    infoLines.push(`${Math.round(scatter.sample_rate * 100)}% sample`);
  }

  return (
    <div
      style={{
        marginTop: "2rem",
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
          marginBottom: "1.25rem",
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: "1.4rem" }}>Sentiment Scatter</h3>
          <p style={{ margin: 0, opacity: 0.6 }}>
            Your vibe plotted between two seeded emotions
          </p>
        </div>
        {infoLines.length > 0 && (
          <p
            style={{
              margin: 0,
              opacity: 0.6,
              fontSize: "0.9rem",
              textAlign: "right",
            }}
          >
            {infoLines.join(" · ")}
          </p>
        )}
      </div>
      <div
        style={{
          position: "relative",
          borderRadius: "1.25rem",
          background:
            "linear-gradient(160deg, rgba(17,24,39,0.95), rgba(9,12,21,0.98)), repeating-linear-gradient(0deg, rgba(255,255,255,0.035), rgba(255,255,255,0.035) 1px, transparent 1px, transparent 46px), repeating-linear-gradient(90deg, rgba(255,255,255,0.035), rgba(255,255,255,0.035) 1px, transparent 1px, transparent 46px)",
          border: "1px solid rgba(255,255,255,0.06)",
          height: "360px",
          padding: "1.5rem",
        }}
      >
        <AxisCorner axis={xAxis} position="top" />
        <AxisCorner axis={yAxis} position="right" />
        <AxisCorner axis={xAxis} position="bottom" flipped />
        <AxisCorner axis={yAxis} position="left" flipped />
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "1.5rem",
            bottom: "1.5rem",
            width: "1px",
            background: "rgba(255,255,255,0.14)",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "1.5rem",
            right: "1.5rem",
            height: "1px",
            background: "rgba(255,255,255,0.14)",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: "1.5rem",
          }}
        >
          {points.map((point, idx) => {
            const x = jitter(normalize(point.x), idx);
            const y = jitter(normalize(point.y), idx + 137);
            const gradient = stageColors[point.stage];
            const fallback = point.stage === "sent" ? "#ec4899" : "#22d3ee";
            const size = point.stage === "sent" ? 11 : 8;
            const isSent = point.stage === "sent";
            return (
              <div
                key={`${point.stage}-${idx}`}
                title={`${stageLabel[point.stage] || point.stage || "Point"} · ${
                  point.period || "Unknown"
                } · ${point.score !== undefined ? point.score.toFixed(2) : ""}`}
                style={{
                  position: "absolute",
                  left: `${x * 100}%`,
                  top: `${(1 - y) * 100}%`,
                  width: `${size}px`,
                  height: `${size}px`,
                  transform: isSent
                    ? "translate(-50%, -50%)"
                    : "translate(-50%, -50%) rotate(45deg)",
                  borderRadius: isSent ? "50%" : "4px",
                  background:
                    typeof gradient === "string" &&
                    gradient.startsWith("linear-gradient")
                      ? undefined
                      : gradient || fallback,
                  backgroundImage:
                    gradient && gradient.startsWith("linear-gradient")
                      ? gradient
                      : undefined,
                  opacity: 0.9,
                  boxShadow: isSent
                    ? "0 0 12px rgba(236,72,153,0.35)"
                    : "0 0 12px rgba(34,211,238,0.35)",
                }}
              />
            );
          })}
        </div>
        <Legend stages={points} />
      </div>
    </div>
  );
}

function AxisCorner({ axis, position, flipped = false }) {
  if (!axis || !axis.seed) return null;
  const baseStyle = {
    position: "absolute",
    fontSize: "0.8rem",
    opacity: flipped ? 0.55 : 0.8,
    maxWidth: "180px",
    lineHeight: 1.3,
  };
  const positions = {
    top: {
      top: "0.75rem",
      left: "50%",
      transform: "translateX(-50%)",
      textAlign: "center",
    },
    bottom: {
      bottom: "0.75rem",
      left: "50%",
      transform: "translateX(-50%)",
      textAlign: "center",
    },
    right: {
      right: "0.75rem",
      top: "50%",
      transform: "translateY(-50%)",
      textAlign: "right",
    },
    left: {
      left: "0.75rem",
      top: "50%",
      transform: "translateY(-50%)",
      textAlign: "left",
    },
  };
  const label = flipped ? `Opposite of "${axis.seed}"` : `"${axis.seed}"`;
  return (
    <div style={{ ...baseStyle, ...positions[position] }}>
      <strong>{axis.label || axis.id}</strong>
      <div style={{ fontStyle: "italic" }}>{label}</div>
    </div>
  );
}

function Legend({ stages }) {
  const seen = new Set();
  const entries = [];
  stages.forEach((point) => {
    const stage = point.stage || "sent";
    if (seen.has(stage)) return;
    seen.add(stage);
    entries.push({ stage, color: stageColors[stage] || "#fbbf24" });
  });
  if (entries.length === 0) return null;

  return (
    <div
      style={{
        position: "absolute",
        bottom: "0.75rem",
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        gap: "1.25rem",
        fontSize: "0.85rem",
        opacity: 0.9,
      }}
    >
      {entries.map(({ stage, color }) => (
        <div
          key={stage}
          style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}
        >
          <span
            style={{
              display: "inline-block",
              width: "11px",
              height: "11px",
              borderRadius: stage === "sent" ? "50%" : "3px",
              background:
                typeof color === "string" && color.startsWith("linear-gradient")
                  ? undefined
                  : color,
              backgroundImage:
                color && color.startsWith("linear-gradient") ? color : undefined,
            }}
          />
          {stageLabel[stage] || stage}
        </div>
      ))}
    </div>
  );
}
