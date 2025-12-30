import StatCard from "./StatCard";

export default function HeroSection({ year, volume, percentiles = {} }) {
  return (
    <div className="hero">
      <h1>
        Your <span className="gradient-text">{year}</span> in Messages
      </h1>

      <div className="stats-grid">
        <StatCard
          label="Messages Sent"
          value={volume?.total_sent?.toLocaleString() || 0}
          percentile={percentiles["volume.total_sent"]}
        />

        <StatCard
          label="Messages Received"
          value={volume?.total_received?.toLocaleString() || 0}
          percentile={percentiles["volume.total_received"]}
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
