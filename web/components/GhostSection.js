import StatCard from "./StatCard";

export default function GhostSection({ ghosts, percentiles = {}, ranks = {}, metricCounts = {}, totalWraps = 0 }) {
  if (!ghosts) return null;

  const totalYou = ghosts.people_you_left_hanging || 0;
  const totalThem = ghosts.people_who_left_you_hanging || 0;
  const hasData = totalYou > 0 || totalThem > 0;
  if (!hasData) return null;

  const timeline = ghosts.timeline_days || 7;
  const minConsecutive = ghosts.min_consecutive_messages || 3;
  const minConversation = ghosts.min_conversation_messages || 10;
  const ratio = ghosts.ghost_ratio;

  return (
    <div className="section">
      <h2 className="section-title">👻 Ghost Mode</h2>
      <p className="section-subtitle">
        Counting chats with at least {minConversation} total
        messages, and {minConsecutive}+ texts in a row.
      </p>

      <div className="stats-grid">
        <StatCard
          label="People You Left Hanging"
          value={totalYou.toLocaleString()}
          percentile={percentiles["ghosts.people_you_left_hanging"]}
          rank={ranks["ghosts.people_you_left_hanging"]}
          metricTotal={metricCounts["ghosts.people_you_left_hanging"]}
          totalWraps={totalWraps}
          valueStyle={{ fontSize: "2rem" }}
        />
        <StatCard
          label="People Who Left You Hanging"
          value={totalThem.toLocaleString()}
          percentile={percentiles["ghosts.people_who_left_you_hanging"]}
          rank={ranks["ghosts.people_who_left_you_hanging"]}
          metricTotal={metricCounts["ghosts.people_who_left_you_hanging"]}
          totalWraps={totalWraps}
          valueStyle={{ fontSize: "2rem" }}
        />
        {typeof ratio === "number" && (
          <StatCard
            label="Ghost Ratio (You/Them)"
            value={ratio.toFixed(2)}
            percentile={percentiles["ghosts.ghost_ratio"]}
            rank={ranks["ghosts.ghost_ratio"]}
            metricTotal={metricCounts["ghosts.ghost_ratio"]}
            totalWraps={totalWraps}
            valueStyle={{ fontSize: "2rem" }}
          />
        )}
      </div>
    </div>
  );
}
