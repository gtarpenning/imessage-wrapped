import ComparisonStatsCard from "./ComparisonStatsCard";

export default function ComparisonConversationsSection({
  conversations1,
  conversations2,
  year1,
  year2,
}) {
  if (!conversations1 || !conversations2) return null;

  return (
    <div className="section comparison-conversations">
      <h2 className="section-title">💬 Conversations Evolution</h2>

      <div className="stats-grid">
        <ComparisonStatsCard
          label="Total Conversations"
          value1={conversations1.total_conversations}
          value2={conversations2.total_conversations}
          year1={year1}
          year2={year2}
          higherIsBetter={true}
        />
        <ComparisonStatsCard
          label="Group Chats"
          value1={conversations1.group_chats}
          value2={conversations2.group_chats}
          year1={year1}
          year2={year2}
          higherIsBetter={true}
        />
        <ComparisonStatsCard
          label="1-on-1 Chats"
          value1={conversations1.one_on_one_chats}
          value2={conversations2.one_on_one_chats}
          year1={year1}
          year2={year2}
          higherIsBetter={true}
        />
        <ComparisonStatsCard
          label="Group Chat %"
          value1={conversations1.group_vs_1on1_ratio?.group_percentage || 0}
          value2={conversations2.group_vs_1on1_ratio?.group_percentage || 0}
          year1={year1}
          year2={year2}
          format="decimal"
          suffix="%"
          higherIsBetter={true}
        />
      </div>

      {/* Most active thread comparison */}
      {conversations1.most_active_thread &&
        conversations2.most_active_thread && (
          <div className="comparison-highlight">
            <h3>Most Active Thread</h3>
            <div className="comparison-row">
              <div className="comparison-item year1-item">
                <span className="year-tag">{year1}</span>
                <p className="thread-name">
                  {conversations1.most_active_thread.name}
                </p>
                <p className="thread-count">
                  {conversations1.most_active_thread.message_count.toLocaleString()}{" "}
                  messages
                </p>
              </div>
              <div className="comparison-item year2-item">
                <span className="year-tag">{year2}</span>
                <p className="thread-name">
                  {conversations2.most_active_thread.name}
                </p>
                <p className="thread-count">
                  {conversations2.most_active_thread.message_count.toLocaleString()}{" "}
                  messages
                </p>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}

