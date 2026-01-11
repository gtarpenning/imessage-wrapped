import StatCard from "./StatCard";
import EnhancedText from "./EnhancedText";
import { useEnhancement, PLAYFUL_INSTRUCTION } from "@/hooks/useEnhancement";

const TAPBACK_EMOJIS = {
  love: "❤️",
  like: "👍",
  laugh: "😂",
  emphasize: "❗",
  dislike: "👎",
  question: "❓",
};

const TAPBACK_LABELS = {
  love: "Love",
  like: "Like",
  laugh: "Laugh",
  emphasize: "Emphasize",
  dislike: "Dislike",
  question: "Question",
};

export default function TapbacksSection({ tapbacks, percentiles = {}, ranks = {}, metricCounts = {}, totalWraps = 0 }) {
  if (
    !tapbacks ||
    (tapbacks.total_tapbacks_given === 0 &&
      tapbacks.total_tapbacks_received === 0)
  ) {
    return null;
  }

  const tapbackDistribution = tapbacks.tapback_distribution_given || {};
  const orderedTapbacks = Object.entries(tapbackDistribution)
    .sort((a, b) => b[1] - a[1])
    .map(([type]) => type);

  return (
    <div className="section">
      <h2 className="section-title">❤️ Reactions & Tapbacks</h2>

      <div className="stats-grid">
        {tapbacks.total_tapbacks_given > 0 && (
          <StatCard
            label="Tapbacks Given"
            value={tapbacks.total_tapbacks_given.toLocaleString()}
            percentile={percentiles["tapbacks.total_tapbacks_given"]}
            rank={ranks["tapbacks.total_tapbacks_given"]}
            metricTotal={metricCounts["tapbacks.total_tapbacks_given"]}
            totalWraps={totalWraps}
            valueStyle={{ fontSize: "2rem" }}
          />
        )}
        {tapbacks.total_tapbacks_received > 0 && (
          <StatCard
            label="Tapbacks Received"
            value={tapbacks.total_tapbacks_received.toLocaleString()}
            percentile={percentiles["tapbacks.total_tapbacks_received"]}
            rank={ranks["tapbacks.total_tapbacks_received"]}
            metricTotal={metricCounts["tapbacks.total_tapbacks_received"]}
            totalWraps={totalWraps}
            valueStyle={{ fontSize: "2rem" }}
          />
        )}
      </div>

      {orderedTapbacks.length > 0 && (
        <TapbackReactionsSection
          orderedTapbacks={orderedTapbacks}
          tapbackDistribution={tapbackDistribution}
          percentiles={percentiles}
          ranks={ranks}
          metricCounts={metricCounts}
          totalWraps={totalWraps}
        />
      )}
    </div>
  );
}

function TapbackReactionsSection({ orderedTapbacks, tapbackDistribution, percentiles, ranks, metricCounts, totalWraps }) {
  const tapbackPercentile = percentiles ? percentiles["tapbacks.total_tapbacks_given"] : undefined;
  const percentileContext = tapbackPercentile !== undefined && tapbackPercentile !== null && totalWraps > 0
    ? ` More than ${tapbackPercentile}% of ${totalWraps.toLocaleString()} users.`
    : "";
  
  const prompt = orderedTapbacks[0]
    ? `Your favorite tapback reaction is ${TAPBACK_LABELS[orderedTapbacks[0]]} ${TAPBACK_EMOJIS[orderedTapbacks[0]]} which you used ${tapbackDistribution[orderedTapbacks[0]]} times.${percentileContext} ${PLAYFUL_INSTRUCTION}`
    : null;

  const { enhancement } = useEnhancement(prompt, !!prompt);
  
  const calculateRatioDisplay = (likes, dislikes) => {
    if (dislikes === 0) return `${likes}:0`;
    
    const ratio = likes / dislikes;
    if (ratio >= 1) {
      return `${Math.round(ratio)}:1`;
    } else {
      return `1:${Math.round(1 / ratio)}`;
    }
  };
  
  const getRatioColor = (likes, dislikes) => {
    const netScore = likes - dislikes;
    if (netScore > 0) return "#10b981";
    if (netScore < 0) return "#ef4444";
    return "#6b7280";
  };

  return (
    <div style={{ marginTop: "2rem" }}>
      <h3
        style={{
          textAlign: "center",
          fontSize: "1.5rem",
          marginBottom: enhancement ? "0.5rem" : "1.5rem",
          opacity: 0.85,
        }}
      >
        Your Reactions
      </h3>
      {enhancement && (
        <EnhancedText style={{ marginBottom: "1.5rem" }}>
          {enhancement}
        </EnhancedText>
      )}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: "1rem",
          maxWidth: "1100px",
          margin: "0 auto",
        }}
      >
        {orderedTapbacks.map((type) => (
          <div
            key={type}
            style={{
              background: "rgba(255, 255, 255, 0.05)",
              borderRadius: "12px",
              padding: "1.5rem",
              textAlign: "center",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              transition: "all 0.3s ease",
            }}
          >
            <div style={{ fontSize: "3rem", marginBottom: "0.5rem" }}>
              {TAPBACK_EMOJIS[type]}
            </div>
            <div
              style={{
                fontSize: "0.9rem",
                opacity: 0.7,
                marginBottom: "0.25rem",
              }}
            >
              {TAPBACK_LABELS[type]}
            </div>
            <div
              style={{
                fontSize: "1.75rem",
                fontWeight: "bold",
                color: "#a78bfa",
              }}
            >
              {tapbackDistribution[type].toLocaleString()}
            </div>
          </div>
        ))}
      </div>

      {(tapbackDistribution.like > 0 || tapbackDistribution.dislike > 0) && (
        <div style={{ marginTop: "2rem" }}>
          <StatCard
            label={
              <div>
                <div>👍 / 👎</div>
                <div style={{ fontSize: "0.75rem", marginTop: "0.25rem" }}>
                  Like to Dislike Ratio
                </div>
              </div>
            }
            value={calculateRatioDisplay(
              tapbackDistribution.like || 0,
              tapbackDistribution.dislike || 0
            )}
            valueStyle={{
              fontSize: "2.5rem",
              color: getRatioColor(
                tapbackDistribution.like || 0,
                tapbackDistribution.dislike || 0
              ),
            }}
            percentile={percentiles["tapbacks.like_to_dislike_ratio"]}
            rank={ranks["tapbacks.like_to_dislike_ratio"]}
            metricTotal={metricCounts["tapbacks.like_to_dislike_ratio"]}
            totalWraps={totalWraps}
          />
          <div
            style={{
              textAlign: "center",
              fontSize: "0.85rem",
              opacity: 0.6,
              marginTop: "0.5rem",
            }}
          >
            {(tapbackDistribution.like || 0).toLocaleString()} likes vs{" "}
            {(tapbackDistribution.dislike || 0).toLocaleString()} dislikes
          </div>
        </div>
      )}
    </div>
  );
}
