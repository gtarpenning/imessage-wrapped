"use client";

import { useMemo } from "react";
import ComparisonStatsCard from "./ComparisonStatsCard";

const monthNames = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export default function ComparisonSentimentSection({
  sentiment1,
  sentiment2,
  year1,
  year2,
}) {
  // Prepare overlaid monthly data
  const monthlyData = useMemo(() => {
    if (!sentiment1 || !sentiment2) return [];
    const periods1 = sentiment1.periods?.overall || [];
    const periods2 = sentiment2.periods?.overall || [];

    // Create a map of all periods
    const periodMap = new Map();

    periods1.forEach((p) => {
      const month = p.period.split("-")[1]; // Extract month from YYYY-MM
      periodMap.set(month, { month, score1: p.avg_score, score2: null });
    });

    periods2.forEach((p) => {
      const month = p.period.split("-")[1];
      if (periodMap.has(month)) {
        periodMap.get(month).score2 = p.avg_score;
      } else {
        periodMap.set(month, { month, score1: null, score2: p.avg_score });
      }
    });

    // Convert to array and sort by month
    return Array.from(periodMap.values()).sort((a, b) =>
      a.month.localeCompare(b.month)
    );
  }, [sentiment1, sentiment2]);

  // Calculate dynamic bounds for y-axis
  const { minScore, maxScore } = useMemo(() => {
    const allScores = monthlyData
      .flatMap((d) => [d.score1, d.score2])
      .filter((s) => s !== null);
    
    if (allScores.length === 0) return { minScore: -1, maxScore: 1 };
    
    const min = Math.min(...allScores);
    const max = Math.max(...allScores);
    
    // Add 10% padding to make the chart more readable
    const range = max - min;
    const padding = range * 0.1;
    
    return {
      minScore: min - padding,
      maxScore: max + padding,
    };
  }, [monthlyData]);

  // Find biggest sentiment shifts
  const biggestShifts = useMemo(() => {
    const shifts = monthlyData
      .filter((d) => d.score1 !== null && d.score2 !== null)
      .map((d) => ({
        month: monthNames[parseInt(d.month) - 1],
        shift: d.score2 - d.score1,
        score1: d.score1,
        score2: d.score2,
      }))
      .sort((a, b) => Math.abs(b.shift) - Math.abs(a.shift))
      .slice(0, 3);

    return shifts;
  }, [monthlyData]);

  if (!sentiment1 || !sentiment2) return null;

  const hasTrend1 = Boolean(sentiment1?.periods?.overall?.length);
  const hasTrend2 = Boolean(sentiment2?.periods?.overall?.length);

  if (!hasTrend1 || !hasTrend2) return null;

  const getSentimentLabel = (score) => {
    if (score > 0.1) return "Positive";
    if (score < -0.1) return "Negative";
    return "Neutral";
  };

  const getSentimentColor = (score) => {
    if (score > 0.1) return "#10b981"; // green
    if (score < -0.1) return "#ef4444"; // red
    return "#8b5cf6"; // purple
  };

  return (
    <div className="section comparison-sentiment">
      <h2 className="section-title">🧠 Your Sentiment Evolution</h2>

      <div className="stats-grid">
        <ComparisonStatsCard
          label="Your Sentiment"
          value1={sentiment1.overall.avg_score}
          value2={sentiment2.overall.avg_score}
          year1={year1}
          year2={year2}
          format="decimal"
          higherIsBetter={true}
        />
        <ComparisonStatsCard
          label="Your Messages Analyzed"
          value1={sentiment1.overall.message_count}
          value2={sentiment2.overall.message_count}
          year1={year1}
          year2={year2}
          higherIsBetter={true}
        />
      </div>

      {/* Overlaid Monthly Sentiment Chart */}
      <div className="comparison-chart-container">
        <h3 className="chart-title">Your Monthly Sentiment Comparison</h3>
        <div className="comparison-legend">
          <span className="legend-item year1">
            <span className="legend-color"></span>
            {year1}
          </span>
          <span className="legend-item year2">
            <span className="legend-color"></span>
            {year2}
          </span>
        </div>
        <div className="sentiment-comparison-chart">
          <svg viewBox="0 0 600 300" className="sentiment-chart-svg">
            {(() => {
              // Calculate y-coordinate based on dynamic range
              const scoreToY = (score) => {
                const range = maxScore - minScore;
                const normalized = (maxScore - score) / range;
                return 40 + normalized * 220; // Chart area: y=40 to y=260
              };

              // Zero line (if within range)
              const zeroY = minScore <= 0 && maxScore >= 0 ? scoreToY(0) : null;

              return (
                <>
                  {/* Zero line */}
                  {zeroY !== null && (
                    <line
                      x1="50"
                      y1={zeroY}
                      x2="550"
                      y2={zeroY}
                      stroke="rgba(255,255,255,0.1)"
                      strokeWidth="1"
                      strokeDasharray="4,4"
                    />
                  )}

                  {/* Y-axis labels */}
                  <text x="30" y="45" className="chart-label" textAnchor="end">
                    {maxScore.toFixed(2)}
                  </text>
                  <text x="30" y="155" className="chart-label" textAnchor="end">
                    {((maxScore + minScore) / 2).toFixed(2)}
                  </text>
                  <text x="30" y="265" className="chart-label" textAnchor="end">
                    {minScore.toFixed(2)}
                  </text>

                  {/* Data lines */}
                  {monthlyData.length > 1 && (
                    <>
                      {/* Year 1 line */}
                      <polyline
                        points={monthlyData
                          .map((d, i) => {
                            if (d.score1 === null) return null;
                            const x = 50 + (i / (monthlyData.length - 1)) * 500;
                            const y = scoreToY(d.score1);
                            return `${x},${y}`;
                          })
                          .filter(Boolean)
                          .join(" ")}
                        fill="none"
                        stroke="#60a5fa"
                        strokeWidth="3"
                        className="year1-line"
                      />

                      {/* Year 2 line */}
                      <polyline
                        points={monthlyData
                          .map((d, i) => {
                            if (d.score2 === null) return null;
                            const x = 50 + (i / (monthlyData.length - 1)) * 500;
                            const y = scoreToY(d.score2);
                            return `${x},${y}`;
                          })
                          .filter(Boolean)
                          .join(" ")}
                        fill="none"
                        stroke="#f472b6"
                        strokeWidth="3"
                        className="year2-line"
                      />

                      {/* Data points */}
                      {monthlyData.map((d, i) => {
                        const x = 50 + (i / (monthlyData.length - 1)) * 500;
                        return (
                          <g key={i}>
                            {d.score1 !== null && (
                              <circle
                                cx={x}
                                cy={scoreToY(d.score1)}
                                r="4"
                                fill="#60a5fa"
                                className="data-point"
                              />
                            )}
                            {d.score2 !== null && (
                              <circle
                                cx={x}
                                cy={scoreToY(d.score2)}
                                r="4"
                                fill="#f472b6"
                                className="data-point"
                              />
                            )}
                            {i % 3 === 0 && (
                              <text
                                x={x}
                                y="285"
                                className="chart-label"
                                textAnchor="middle"
                              >
                                {monthNames[parseInt(d.month) - 1]}
                              </text>
                            )}
                          </g>
                        );
                      })}
                    </>
                  )}
                </>
              );
            })()}
          </svg>
        </div>
      </div>

      {/* Biggest Sentiment Shifts */}
      {biggestShifts.length > 0 && (
        <div className="sentiment-shifts">
          <h3>Your Biggest Sentiment Changes</h3>
          <div className="shifts-list">
            {biggestShifts.map((shift, i) => (
              <div key={i} className="shift-item">
                <span className="shift-month">{shift.month}</span>
                <div className="shift-visual">
                  <span
                    className="shift-score"
                    style={{ color: getSentimentColor(shift.score1) }}
                  >
                    {shift.score1.toFixed(2)}
                  </span>
                  <span
                    className={`shift-arrow ${shift.shift > 0 ? "positive" : "negative"}`}
                  >
                    {shift.shift > 0 ? "↑" : "↓"}
                  </span>
                  <span
                    className="shift-score"
                    style={{ color: getSentimentColor(shift.score2) }}
                  >
                    {shift.score2.toFixed(2)}
                  </span>
                </div>
                <span className="shift-magnitude">
                  {Math.abs(shift.shift).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

