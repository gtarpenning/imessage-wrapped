export default function ComparisonStatsCard({
  label,
  value1,
  value2,
  year1,
  year2,
  format = "number", // 'number', 'time', 'percentage', 'decimal'
  higherIsBetter = true,
  suffix = "",
}) {
  const formatValue = (value, format) => {
    if (value === null || value === undefined) return "—";

    switch (format) {
      case "number":
        return typeof value === "number"
          ? value.toLocaleString()
          : value;
      case "time":
        return value; // Assume already formatted
      case "percentage":
        return `${value}%`;
      case "decimal":
        return typeof value === "number"
          ? value.toFixed(2)
          : value;
      default:
        return value;
    }
  };

  const delta = typeof value1 === "number" && typeof value2 === "number"
    ? value2 - value1
    : null;

  const percentChange = delta !== null && value1 !== 0
    ? ((delta / value1) * 100).toFixed(1)
    : null;

  const isPositive = delta !== null
    ? (higherIsBetter ? delta > 0 : delta < 0)
    : null;

  const isNeutral = delta === 0;

  return (
    <div className="comparison-stat-card">
      <div className="stat-label">{label}</div>
      <div className="comparison-values">
        <div className="year-value year1-value">
          <span className="year-tag">{year1}</span>
          <span className="value">
            {formatValue(value1, format)}
            {suffix && ` ${suffix}`}
          </span>
        </div>

        {percentChange !== null && (
          <div
            className={`delta-indicator ${
              isNeutral ? "neutral" : isPositive ? "positive" : "negative"
            }`}
          >
            {!isNeutral && (
              <>
                <span className="delta-arrow">
                  {delta > 0 ? "↑" : "↓"}
                </span>
                <span className="delta-percent">
                  {Math.abs(parseFloat(percentChange))}%
                </span>
              </>
            )}
            {isNeutral && <span className="delta-neutral">—</span>}
          </div>
        )}

        <div className="year-value year2-value">
          <span className="year-tag">{year2}</span>
          <span className="value">
            {formatValue(value2, format)}
            {suffix && ` ${suffix}`}
          </span>
        </div>
      </div>
    </div>
  );
}

