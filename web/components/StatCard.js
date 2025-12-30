export default function StatCard({ label, value, valueStyle = {}, percentile }) {
  return (
    <div className="stat-card">
      {percentile !== undefined && percentile !== null && (
        <div className="percentile-badge">
          Top {100 - percentile}%
        </div>
      )}
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={valueStyle}>
        {value}
      </div>
    </div>
  );
}
