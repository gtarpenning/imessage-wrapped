import SentimentTrend from "./SentimentTrend";

export default function MessageAnalysisSection({ sentiment }) {
  if (!sentiment) return null;

  const hasTrend = Boolean(sentiment?.periods?.overall?.length);

  if (!hasTrend) {
    return null;
  }

  return (
    <div className="section">
      <h2 className="section-title">🧠 Your Message Sentiment</h2>
      <SentimentTrend sentiment={sentiment} />
    </div>
  );
}
