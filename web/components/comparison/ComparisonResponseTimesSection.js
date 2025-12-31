import ComparisonStatsCard from "./ComparisonStatsCard";

export default function ComparisonResponseTimesSection({
  response_times1,
  response_times2,
  year1,
  year2,
}) {
  if (!response_times1 || !response_times2) return null;

  const formatTime = (seconds) => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.round(seconds / 3600)}h`;
    return `${Math.round(seconds / 86400)}d`;
  };

  return (
    <div className="section comparison-response-times">
      <h2 className="section-title">⚡ Response Speed Evolution</h2>

      <div className="stats-grid">
        <div className="comparison-stat-card">
          <div className="stat-label">Your Response Time</div>
          <div className="comparison-values">
            <div className="year-value year1-value">
              <span className="year-tag">{year1}</span>
              <span className="value">
                {response_times1.median_response_time_you_formatted}
              </span>
            </div>
            <div className="delta-indicator">
              {response_times2.median_response_time_you_seconds <
              response_times1.median_response_time_you_seconds ? (
                <span className="positive">
                  ⚡ Faster
                </span>
              ) : response_times2.median_response_time_you_seconds >
                response_times1.median_response_time_you_seconds ? (
                <span className="negative">
                  🐌 Slower
                </span>
              ) : (
                <span className="neutral">Same</span>
              )}
            </div>
            <div className="year-value year2-value">
              <span className="year-tag">{year2}</span>
              <span className="value">
                {response_times2.median_response_time_you_formatted}
              </span>
            </div>
          </div>
        </div>

        <div className="comparison-stat-card">
          <div className="stat-label">Their Response Time</div>
          <div className="comparison-values">
            <div className="year-value year1-value">
              <span className="year-tag">{year1}</span>
              <span className="value">
                {response_times1.median_response_time_them_formatted}
              </span>
            </div>
            <div className="delta-indicator">
              {response_times2.median_response_time_them_seconds <
              response_times1.median_response_time_them_seconds ? (
                <span className="positive">
                  ⚡ Faster
                </span>
              ) : response_times2.median_response_time_them_seconds >
                response_times1.median_response_time_them_seconds ? (
                <span className="negative">
                  🐌 Slower
                </span>
              ) : (
                <span className="neutral">Same</span>
              )}
            </div>
            <div className="year-value year2-value">
              <span className="year-tag">{year2}</span>
              <span className="value">
                {response_times2.median_response_time_them_formatted}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

