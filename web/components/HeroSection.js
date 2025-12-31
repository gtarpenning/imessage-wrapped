import StatCard from "./StatCard";

export default function HeroSection({ year, volume, percentiles = {}, ranks = {}, metricCounts = {}, totalWraps = 0, userName = null }) {
  // Capitalize each word in the name (e.g., "griffin tarpenning" → "Griffin Tarpenning")
  const capitalizeWords = (str) => {
    if (!str) return str;
    return str
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  // Format the user's name for display (e.g., "Griffin" becomes "Griffin's")
  const possessiveName = userName 
    ? (() => {
        const capitalized = capitalizeWords(userName);
        return capitalized.endsWith('s') ? `${capitalized}'` : `${capitalized}'s`;
      })()
    : 'Your';

  return (
    <div className="hero">
      <h1>
        <span style={{ color: '#fde047' }}>{possessiveName}</span> <span className="gradient-text">{year}</span> in Messages
      </h1>

      <div className="stats-grid">
        <StatCard
          label="Messages Sent"
          value={volume?.total_sent?.toLocaleString() || 0}
          percentile={percentiles["volume.total_sent"]}
          rank={ranks["volume.total_sent"]}
          metricTotal={metricCounts["volume.total_sent"]}
          totalWraps={totalWraps}
        />

        <StatCard
          label="Messages Received"
          value={volume?.total_received?.toLocaleString() || 0}
          percentile={percentiles["volume.total_received"]}
          rank={ranks["volume.total_received"]}
          metricTotal={metricCounts["volume.total_received"]}
          totalWraps={totalWraps}
          valueStyle={{
            background: "linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        />
      </div>
    </div>
  );
}
