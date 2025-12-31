import StatCard from "./StatCard";
import PhraseHighlights from "./PhraseHighlights";
import EnhancedText from "./EnhancedText";
import { useEnhancement, PLAYFUL_INSTRUCTION } from "@/hooks/useEnhancement";

export default function ContentSection({ content, percentiles = {}, totalWraps = 0 }) {
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
            totalWraps={totalWraps}
            valueStyle={{ fontSize: "2rem" }}
          />
        )}
        {content.avg_message_length_received !== undefined && (
          <StatCard
            label="Avg Message Length (Received)"
            value={`${Math.round(content.avg_message_length_received)} chars`}
            percentile={percentiles["content.avg_message_length_received"]}
            totalWraps={totalWraps}
            valueStyle={{ fontSize: "2rem" }}
          />
        )}
        {content.questions_percentage !== undefined && (
          <StatCard
            label="❓ Questions Asked"
            value={`${content.questions_percentage}%`}
            percentile={percentiles["content.questions_percentage"]}
            totalWraps={totalWraps}
            valueStyle={{ fontSize: "2rem" }}
          />
        )}
        {content.enthusiasm_percentage !== undefined && (
          <StatCard
            label="❗ Enthusiasm Level"
            value={`${content.enthusiasm_percentage}%`}
            percentile={percentiles["content.enthusiasm_percentage"]}
            totalWraps={totalWraps}
            valueStyle={{ fontSize: "2rem" }}
          />
        )}
        {content.attachments_sent !== undefined && (
          <StatCard
            label="📎 Attachments Sent"
            value={content.attachments_sent.toLocaleString()}
            percentile={percentiles["content.attachments_sent"]}
            totalWraps={totalWraps}
            valueStyle={{ fontSize: "2rem" }}
          />
        )}
        {content.attachments_received !== undefined && (
          <StatCard
            label="📎 Attachments Received"
            value={content.attachments_received.toLocaleString()}
            percentile={percentiles["content.attachments_received"]}
            totalWraps={totalWraps}
            valueStyle={{ fontSize: "2rem" }}
          />
        )}
      </div>

      <DoubleTextSection content={content} percentiles={percentiles} totalWraps={totalWraps} />

      <EmojiSection content={content} />

      <PhraseHighlights
        overall={content.phrases?.overall}
        signature={content._phrases_by_contact}
      />
    </div>
  );
}

function DoubleTextSection({ content, percentiles, totalWraps }) {
  const prompt =
    content.double_text_count !== undefined
      ? `You sent ${content.double_text_count} double texts, that's ${content.double_text_percentage}% of your messages. ${PLAYFUL_INSTRUCTION}`
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
      <div className="stats-grid" style={{ justifyContent: "center" }}>
        <StatCard
          label="Double Texts Sent"
          value={content.double_text_count.toLocaleString()}
          percentile={percentiles["content.double_text_count"]}
          totalWraps={totalWraps}
          valueStyle={{ fontSize: "2.5rem", color: "#06b6d4" }}
        />
      </div>
      {content.double_text_percentage !== undefined && (
        <p style={{ opacity: 0.7, textAlign: "center", marginTop: "1rem" }}>
          ({content.double_text_percentage}% of your messages)
        </p>
      )}
    </div>
  );
}

function EmojiSection({ content }) {
  const hasEmojis =
    content.most_used_emojis && content.most_used_emojis.length > 0;
  const prompt = hasEmojis
    ? `Your favorite emoji was ${content.most_used_emojis[0].emoji} which you used ${content.most_used_emojis[0].count} times. ${PLAYFUL_INSTRUCTION}`
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
