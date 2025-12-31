import StatCard from "./StatCard";
import PhraseHighlights from "./PhraseHighlights";
import EnhancedText from "./EnhancedText";
import { useEnhancement, PLAYFUL_INSTRUCTION } from "@/hooks/useEnhancement";

export default function ContentSection({ content, percentiles = {}, ranks = {}, metricCounts = {}, totalWraps = 0 }) {
  if (!content) return null;

  return (
    <div className="section">
      <h2 className="section-title">💬 Message Content</h2>

      <div className="stats-grid">
        {content.avg_message_length_sent !== undefined && (
          <StatCard
            label="Avg Message Length (Sent)"
            value={`${Math.round(content.avg_message_length_sent)} chars`}
            percentile={percentiles["content.avg_message_length_sent"]}
            rank={ranks["content.avg_message_length_sent"]}
            metricTotal={metricCounts["content.avg_message_length_sent"]}
            totalWraps={totalWraps}
            valueStyle={{ fontSize: "2rem" }}
          />
        )}
        {content.avg_message_length_received !== undefined && (
          <StatCard
            label="Avg Message Length (Received)"
            value={`${Math.round(content.avg_message_length_received)} chars`}
            percentile={percentiles["content.avg_message_length_received"]}
            rank={ranks["content.avg_message_length_received"]}
            metricTotal={metricCounts["content.avg_message_length_received"]}
            totalWraps={totalWraps}
            valueStyle={{ fontSize: "2rem" }}
          />
        )}
        {content.questions_percentage !== undefined && (
          <StatCard
            label="❓ Questions Asked"
            value={`${content.questions_percentage}%`}
            percentile={percentiles["content.questions_percentage"]}
            rank={ranks["content.questions_percentage"]}
            metricTotal={metricCounts["content.questions_percentage"]}
            totalWraps={totalWraps}
            valueStyle={{ fontSize: "2rem" }}
          />
        )}
        {content.enthusiasm_percentage !== undefined && (
          <StatCard
            label="❗ Enthusiasm Level"
            value={`${content.enthusiasm_percentage}%`}
            percentile={percentiles["content.enthusiasm_percentage"]}
            rank={ranks["content.enthusiasm_percentage"]}
            metricTotal={metricCounts["content.enthusiasm_percentage"]}
            totalWraps={totalWraps}
            valueStyle={{ fontSize: "2rem" }}
          />
        )}
        {content.attachments_sent !== undefined && (
          <StatCard
            label="📎 Attachments Sent"
            value={content.attachments_sent.toLocaleString()}
            percentile={percentiles["content.attachments_sent"]}
            rank={ranks["content.attachments_sent"]}
            metricTotal={metricCounts["content.attachments_sent"]}
            totalWraps={totalWraps}
            valueStyle={{ fontSize: "2rem" }}
          />
        )}
        {content.attachments_received !== undefined && (
          <StatCard
            label="📎 Attachments Received"
            value={content.attachments_received.toLocaleString()}
            percentile={percentiles["content.attachments_received"]}
            rank={ranks["content.attachments_received"]}
            metricTotal={metricCounts["content.attachments_received"]}
            totalWraps={totalWraps}
            valueStyle={{ fontSize: "2rem" }}
          />
        )}
      </div>

      <DoubleTextSection content={content} percentiles={percentiles} ranks={ranks} metricCounts={metricCounts} totalWraps={totalWraps} />

      <EmojiSection content={content} percentiles={percentiles} totalWraps={totalWraps} />

      <PhraseHighlights
        overall={content.phrases?.overall}
        signature={content._phrases_by_contact}
      />
    </div>
  );
}

function DoubleTextSection({ content, percentiles, ranks, metricCounts, totalWraps }) {
  const doubleTextPercentile = percentiles["content.double_text_count"];
  const percentileContext = doubleTextPercentile !== undefined && doubleTextPercentile !== null && totalWraps > 0
    ? ` That's more than ${doubleTextPercentile}% of ${totalWraps.toLocaleString()} users.`
    : "";
  
  const prompt =
    content.double_text_count !== undefined
      ? `You sent ${content.double_text_count} double texts, that's ${content.double_text_percentage}% of your messages.${percentileContext} ${PLAYFUL_INSTRUCTION}`
      : null;
  const { enhancement, loading } = useEnhancement(
    prompt,
    content.double_text_count !== undefined,
  );

  if (content.double_text_count === undefined) return null;

  return (
    <div style={{ marginTop: "2rem" }}>
      <div
        style={{
          textAlign: "center",
          marginBottom: enhancement ? "0.5rem" : "1rem",
        }}
      >
        <p
          style={{
            fontSize: "1.5rem",
            fontWeight: "500",
            opacity: 0.85,
          }}
        >
          Double Text Count
        </p>
      </div>
      {enhancement && <EnhancedText>{enhancement}</EnhancedText>}
      <div className="stats-grid">
        <StatCard
          label="Double Texts Sent"
          value={content.double_text_count.toLocaleString()}
          percentile={percentiles["content.double_text_count"]}
          rank={ranks["content.double_text_count"]}
          metricTotal={metricCounts["content.double_text_count"]}
          totalWraps={totalWraps}
          valueStyle={{ fontSize: "2.5rem", color: "#06b6d4" }}
        />
        {content.quadruple_text_count !== undefined && (
          <StatCard
            label="💥 Quadruple Texts (Crash Outs)"
            value={content.quadruple_text_count.toLocaleString()}
            percentile={percentiles["content.quadruple_text_count"]}
            rank={ranks["content.quadruple_text_count"]}
            metricTotal={metricCounts["content.quadruple_text_count"]}
            totalWraps={totalWraps}
            valueStyle={{ fontSize: "2.5rem", color: "#ef4444" }}
          />
        )}
      </div>
      {content.double_text_percentage !== undefined && (
        <p style={{ opacity: 0.7, textAlign: "center", marginTop: "1rem" }}>
          ({content.double_text_percentage}% of your messages)
        </p>
      )}
    </div>
  );
}

function EmojiSection({ content, percentiles, totalWraps }) {
  const hasEmojis =
    content.most_used_emojis && content.most_used_emojis.length > 0;
  
  // Check for emoji-related percentile (if available)
  const emojiPercentile = percentiles ? percentiles["content.emoji_count"] : undefined;
  const percentileContext = emojiPercentile !== undefined && emojiPercentile !== null && totalWraps > 0
    ? ` That's more emojis than ${emojiPercentile}% of ${totalWraps.toLocaleString()} users.`
    : "";
  
  const prompt = hasEmojis
    ? `Your favorite emoji was ${content.most_used_emojis[0].emoji} which you used ${content.most_used_emojis[0].count} times.${percentileContext} ${PLAYFUL_INSTRUCTION}`
    : null;
  const { enhancement, loading } = useEnhancement(prompt, hasEmojis);

  if (!hasEmojis) return null;

  return (
    <div style={{ marginTop: "2rem" }}>
      <h3
        style={{
          fontSize: "1.5rem",
          fontWeight: "500",
          marginBottom: enhancement ? "0.5rem" : "1rem",
          opacity: 0.85,
          textAlign: "center",
        }}
      >
        Most Used Emojis
      </h3>
      {enhancement && <EnhancedText>{enhancement}</EnhancedText>}
      <div className="emoji-grid">
        {content.most_used_emojis.slice(0, 10).map((emoji, index) => (
          <div key={index} className="emoji-item">
            <div className="emoji">{emoji.emoji}</div>
            <div className="count">{emoji.count}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
