import ComparisonStatsCard from "./ComparisonStatsCard";

export default function ComparisonContentSection({
  content1,
  content2,
  year1,
  year2,
}) {
  if (!content1 || !content2) return null;

  return (
    <div className="section comparison-content">
      <h2 className="section-title">✍️ Writing Style Evolution</h2>

      <div className="stats-grid">
        <ComparisonStatsCard
          label="Avg Message Length"
          value1={content1.avg_message_length_sent}
          value2={content2.avg_message_length_sent}
          year1={year1}
          year2={year2}
          suffix="chars"
          higherIsBetter={true}
        />
        <ComparisonStatsCard
          label="Avg Word Count"
          value1={content1.avg_word_count_sent}
          value2={content2.avg_word_count_sent}
          year1={year1}
          year2={year2}
          suffix="words"
          higherIsBetter={true}
        />
        <ComparisonStatsCard
          label="Questions Asked"
          value1={content1.questions_asked}
          value2={content2.questions_asked}
          year1={year1}
          year2={year2}
          higherIsBetter={true}
        />
        <ComparisonStatsCard
          label="Enthusiasm %"
          value1={content1.enthusiasm_percentage}
          value2={content2.enthusiasm_percentage}
          year1={year1}
          year2={year2}
          format="decimal"
          suffix="%"
          higherIsBetter={true}
        />
        <ComparisonStatsCard
          label="Links Shared"
          value1={content1.links_shared}
          value2={content2.links_shared}
          year1={year1}
          year2={year2}
          higherIsBetter={true}
        />
        <ComparisonStatsCard
          label="Double Text %"
          value1={content1.double_text_percentage}
          value2={content2.double_text_percentage}
          year1={year1}
          year2={year2}
          format="decimal"
          suffix="%"
          higherIsBetter={true}
        />
      </div>

      {/* Top emojis comparison */}
      {content1.most_used_emojis?.length > 0 &&
        content2.most_used_emojis?.length > 0 && (
          <div className="emoji-comparison">
            <h3>Top Emojis</h3>
            <div className="emoji-comparison-grid">
              <div className="emoji-list year1-list">
                <span className="year-tag">{year1}</span>
                {content1.most_used_emojis.slice(0, 5).map((item, i) => (
                  <div key={i} className="emoji-item">
                    <span className="emoji-icon">{item.emoji}</span>
                    <span className="emoji-count">{item.count}</span>
                  </div>
                ))}
              </div>
              <div className="emoji-list year2-list">
                <span className="year-tag">{year2}</span>
                {content2.most_used_emojis.slice(0, 5).map((item, i) => (
                  <div key={i} className="emoji-item">
                    <span className="emoji-icon">{item.emoji}</span>
                    <span className="emoji-count">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
    </div>
  );
}

