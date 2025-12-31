export default function StatCard({ 
  label, 
  value, 
  valueStyle = {}, 
  percentile, 
  totalWraps,
  rank,
  metricTotal 
}) {
  // Use metricTotal if provided (metric-specific count), otherwise fall back to totalWraps
  const total = metricTotal ?? totalWraps;
  
  // Calculate rank from percentile if not provided directly
  const getRankInfo = () => {
    if (rank !== undefined && rank !== null && total) {
      return { rank, total };
    }
    
    if (percentile === undefined || percentile === null || !total) return null;
    
    // Percentile tells us what % of people we're better than
    // So if percentile is 90, we're in top 10%
    const calculatedRank = Math.ceil((total * (100 - percentile)) / 100);
    return { rank: calculatedRank, total };
  };

  const rankInfo = getRankInfo();
  
  // Determine badge type based on rank
  const getBadgeType = () => {
    if (!rankInfo) return 'normal';
    if (rankInfo.rank === 1) return 'first';
    if (rankInfo.rank <= 10) return 'top10';
    return 'normal';
  };
  
  const badgeType = getBadgeType();
  
  const getBadgeClass = () => {
    if (badgeType === 'first') return 'percentile-badge percentile-badge-first';
    if (badgeType === 'top10') return 'percentile-badge percentile-badge-top10';
    return 'percentile-badge';
  };
  
  const getBadgeText = () => {
    if (badgeType === 'first') return '🏆 #1';
    if (badgeType === 'top10') return `⭐ Top ${100 - percentile}%`;
    return `Top ${100 - percentile}%`;
  };

  return (
    <div className="stat-card">
      {percentile !== undefined && percentile !== null && (
        <div className={getBadgeClass()}>
          {getBadgeText()}
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
