export default function StatCard({
  label,
  value,
  valueStyle = {},
  percentile,
  totalWraps,
  rank,
  metricTotal,
}) {
  const total = metricTotal ?? totalWraps;
  const smallSampleThreshold = 25;
  const isBottom10 = percentile !== undefined && percentile !== null && percentile <= 10;

  const getRankInfo = () => {
    if (rank !== undefined && rank !== null && total) {
      return { rank, total };
    }

    if (percentile === undefined || percentile === null || !total) return null;

    const calculatedRank = Math.ceil((total * (100 - percentile)) / 100);
    return { rank: calculatedRank, total };
  };

  const rankInfo = getRankInfo();

  const getBadgeType = () => {
    if (percentile === undefined || percentile === null) return "normal";
    if (rankInfo && rankInfo.rank === 1) return "first";
    if (percentile >= 90) return "top10";
    if (isBottom10) return "bottom10";
    return "normal";
  };

  const badgeType = getBadgeType();

  const getBadgeClass = () => {
    if (badgeType === "first") return "percentile-badge percentile-badge-first";
    if (badgeType === "top10") return "percentile-badge percentile-badge-top10";
    if (badgeType === "bottom10") return "percentile-badge percentile-badge-bottom10";
    return "percentile-badge";
  };

  const getBadgeText = () => {
    if (badgeType === "first") return "🏆 #1";
    if (badgeType === "top10") return `⭐ Top ${100 - percentile}%`;
    if (badgeType === "bottom10") return "🐌 Bottom 10%";
    return `Top ${100 - percentile}%`;
  };

  const sampleSizeHint =
    total && total < smallSampleThreshold
      ? `Small sample: fewer than ${smallSampleThreshold.toLocaleString()} people have this metric (n=${total.toLocaleString()}).`
      : null;

  const tooltipLines = () => {
    if (percentile === undefined || percentile === null) return [];

    const lines = [];

    if (rankInfo) {
      lines.push(`Ranked ${rankInfo.rank} out of ${rankInfo.total.toLocaleString()} users`);
    } else if (total) {
      lines.push(`Based on ${total.toLocaleString()} users`);
    }

    if (isBottom10) {
      lines.push("🐌 You're in the bottom 10% for this metric.");
    }

    if (sampleSizeHint) {
      lines.push(sampleSizeHint);
    }

    return lines;
  };

  const lines = tooltipLines();

  return (
    <div className="stat-card">
      {percentile !== undefined && percentile !== null && (
        <div className={getBadgeClass()}>
          {getBadgeText()}
          {lines.length > 0 && (
            <div className="percentile-tooltip">
              {lines.map((line, index) => (
                <div key={index}>{line}</div>
              ))}
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
