import SentimentTrend from "./SentimentTrend";
import SentimentScatter from "./SentimentScatter";

export default function MessageAnalysisSection({ sentiment }) {
  if (!sentiment) return null;

  const hasTrend = Boolean(sentiment?.periods?.overall?.length);
  const hasScatter = Boolean(sentiment?.scatter?.points?.length);

  if (!hasTrend && !hasScatter) {
    return null;
  }

  return (
    <div className="section">
      <h2 className="section-title">🧠 Message Analysis</h2>
      {hasTrend && <SentimentTrend sentiment={sentiment} />}
      {hasScatter && <SentimentScatter scatter={sentiment.scatter} />}
    </div>
  );
}
