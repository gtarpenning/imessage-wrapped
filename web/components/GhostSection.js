import StatCard from "./StatCard";

export default function GhostSection({ ghosts }) {
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
        A contact only counts if the chat has at least {minConversation} total
        messages, they send {minConsecutive}+ texts in a row, and the other
        person stays silent for {timeline}+ days.
      </p>

      <div className="stats-grid">
        <StatCard
          label="People You Left Hanging"
          value={totalYou.toLocaleString()}
          valueStyle={{ fontSize: "2rem" }}
        />
        <StatCard
          label="People Who Left You Hanging"
          value={totalThem.toLocaleString()}
          valueStyle={{ fontSize: "2rem" }}
        />
        <StatCard
          label="Silence Threshold"
          value={`${timeline} days`}
          valueStyle={{ fontSize: "2rem" }}
        />
        <StatCard
          label="Texts in a Row"
          value={`${minConsecutive}+`}
          valueStyle={{ fontSize: "2rem" }}
        />
        {typeof ratio === "number" && (
          <StatCard
            label="Ghost Ratio (You/Them)"
            value={ratio.toFixed(2)}
            valueStyle={{ fontSize: "2rem" }}
          />
        )}
      </div>
    </div>
  );
}
