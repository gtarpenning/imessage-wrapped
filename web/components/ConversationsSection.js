import StatCard from "./StatCard";

export default function ConversationsSection({ conversations, percentiles = {}, ranks = {}, metricCounts = {}, totalWraps = 0 }) {
  if (!conversations) return null;

  return (
    <div className="section">
      <h2 className="section-title">💭 Conversations</h2>
      <div className="stats-grid">
        {conversations.total_conversations && (
          <StatCard
            label="Total Conversations"
            value={conversations.total_conversations}
            percentile={percentiles["conversations.total_conversations"]}
            rank={ranks["conversations.total_conversations"]}
            metricTotal={metricCounts["conversations.total_conversations"]}
            totalWraps={totalWraps}
            valueStyle={{ fontSize: "2rem" }}
          />
        )}
        {conversations.group_chats !== undefined && (
          <StatCard
            label="Group Chats"
            value={conversations.group_chats}
            percentile={percentiles["conversations.group_chats"]}
            rank={ranks["conversations.group_chats"]}
            metricTotal={metricCounts["conversations.group_chats"]}
            totalWraps={totalWraps}
            valueStyle={{ fontSize: "2rem" }}
          />
        )}
        {conversations.one_on_one_chats !== undefined && (
          <StatCard
            label="1-on-1 Chats"
            value={conversations.one_on_one_chats}
            percentile={percentiles["conversations.one_on_one_chats"]}
            rank={ranks["conversations.one_on_one_chats"]}
            metricTotal={metricCounts["conversations.one_on_one_chats"]}
            totalWraps={totalWraps}
            valueStyle={{ fontSize: "2rem" }}
          />
        )}
      </div>

      {conversations.group_vs_1on1_ratio && (
        <div style={{ marginTop: "2rem", textAlign: "center" }}>
          <p style={{ opacity: 0.8 }}>Group vs 1:1 Ratio</p>
          <p style={{ fontSize: "2rem", fontWeight: "bold", color: "#8b5cf6" }}>
            {conversations.group_vs_1on1_ratio.group_percentage}% /{" "}
            {conversations.group_vs_1on1_ratio.one_on_one_percentage}%
          </p>
        </div>
      )}

      {conversations.most_active_thread &&
        conversations.most_active_thread.name && (
          <div style={{ marginTop: "2rem", textAlign: "center" }}>
            <p style={{ opacity: 0.8 }}>Most Active Thread</p>
            <p
              style={{
                fontSize: "1.8rem",
                fontWeight: "bold",
                color: "#06b6d4",
              }}
            >
              {conversations.most_active_thread.name}
            </p>
            <p style={{ opacity: 0.7 }}>
              {conversations.most_active_thread.message_count.toLocaleString()}{" "}
              messages
              {conversations.most_active_thread.is_group
                ? " (Group)"
                : " (1:1)"}
            </p>
          </div>
        )}

      {conversations.most_active_group_chat &&
        conversations.most_active_group_chat.name && (
          <div style={{ marginTop: "2rem", textAlign: "center" }}>
            <p style={{ opacity: 0.8 }}>Most Active Group Chat</p>
            <p
              style={{
                fontSize: "1.8rem",
                fontWeight: "bold",
                color: "#ec4899",
              }}
            >
              {conversations.most_active_group_chat.name}
            </p>
            <p style={{ opacity: 0.7 }}>
              {conversations.most_active_group_chat.message_count.toLocaleString()}{" "}
              messages
            </p>
          </div>
        )}
    </div>
  );
}
