export default function StatCard({ label, value, valueStyle = {}, percentile, totalWraps }) {
  // Calculate rank from percentile
  const getRankInfo = () => {
    if (percentile === undefined || percentile === null || !totalWraps) return null;
    
    // Percentile tells us what % of people we're better than
    // So if percentile is 90, we're in top 10%
    const rank = Math.ceil((totalWraps * (100 - percentile)) / 100);
    return { rank, total: totalWraps };
  };

  const rankInfo = getRankInfo();

  return (
    <div className="stat-card">
      {percentile !== undefined && percentile !== null && (
        <div className="percentile-badge">
          Top {100 - percentile}%
          {rankInfo && (
            <div className="percentile-tooltip">
              Ranked {rankInfo.rank} out of {rankInfo.total} users
            </div>
          )}
        </div>
      )}
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={valueStyle}>
        {value}
      </div>
    </div>
  );
}
