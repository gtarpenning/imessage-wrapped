"use client";

import { useMemo } from "react";
import ComparisonStatsCard from "./ComparisonStatsCard";

function formatHour(hour) {
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour} ${period}`;
}

export default function ComparisonTemporalSection({
  temporal1,
  temporal2,
  year1,
  year2,
}) {
  // Calculate weekday/weekend averages
  const getWeekdayWeekendStats = (temporal) => {
    if (!temporal) return { weekdayAvg: 0, weekendAvg: 0 };
    const distribution = temporal.day_of_week_distribution || {};
    const weekdayTotal = [0, 1, 2, 3, 4].reduce(
      (sum, day) => sum + (distribution[day] || 0),
      0
    );
    const weekendTotal = [5, 6].reduce(
      (sum, day) => sum + (distribution[day] || 0),
      0
    );
    return {
      weekdayAvg: Math.round(weekdayTotal / (52 * 5)),
      weekendAvg: Math.round(weekendTotal / (52 * 2)),
    };
  };

  const stats1 = getWeekdayWeekendStats(temporal1);
  const stats2 = getWeekdayWeekendStats(temporal2);

  // Get overlaid hour distribution data
  const hourData = useMemo(() => {
    if (!temporal1 || !temporal2) return [];
    const dist1 = temporal1.hour_distribution || {};
    const dist2 = temporal2.hour_distribution || {};

    const data = [];
    for (let hour = 0; hour < 24; hour++) {
      data.push({
        hour,
        label: formatHour(hour),
        value1: parseInt(dist1[hour] || 0, 10),
        value2: parseInt(dist2[hour] || 0, 10),
      });
    }
    return data;
  }, [temporal1, temporal2]);

  const maxHourValue = Math.max(
    ...hourData.map((d) => Math.max(d.value1, d.value2))
  );

  if (!temporal1 || !temporal2) return null;

  return (
    <div className="section comparison-temporal">
      <h2 className="section-title">⏰ When You Text: Evolution</h2>

      <div className="stats-grid">
        <ComparisonStatsCard
          label="Weekday Messages/Day"
          value1={stats1.weekdayAvg}
          value2={stats2.weekdayAvg}
          year1={year1}
          year2={year2}
          higherIsBetter={true}
        />
        <ComparisonStatsCard
          label="Weekend Messages/Day"
          value1={stats1.weekendAvg}
          value2={stats2.weekendAvg}
          year1={year1}
          year2={year2}
          higherIsBetter={true}
        />
      </div>

      {/* Overlaid Hour Distribution */}
      <div className="comparison-chart-container">
        <h3 className="chart-title">Messages by Hour of Day</h3>
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
        <div className="hour-comparison-chart">
          {hourData.map((item) => (
            <div key={item.hour} className="hour-bar-group">
              <div className="hour-bars">
                <div
                  className="hour-bar year1-bar"
                  style={{
                    height: `${(item.value1 / maxHourValue) * 100}%`,
                  }}
                  title={`${year1}: ${item.value1.toLocaleString()} messages at ${item.label}`}
                />
                <div
                  className="hour-bar year2-bar"
                  style={{
                    height: `${(item.value2 / maxHourValue) * 100}%`,
                  }}
                  title={`${year2}: ${item.value2.toLocaleString()} messages at ${item.label}`}
                />
              </div>
              {item.hour % 4 === 0 && (
                <div className="hour-label">{item.label}</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* MVP comparisons */}
      {temporal1.weekday_mvp?.contact && temporal2.weekday_mvp?.contact && (
        <div className="comparison-mvp-container">
          <h3>Weekday Warrior</h3>
          <div className="mvp-comparison">
            <div className="mvp-item year1-item">
              <span className="year-tag">{year1}</span>
              <span className="mvp-name">{temporal1.weekday_mvp.contact}</span>
              <span className="mvp-count">
                {temporal1.weekday_mvp.count?.toLocaleString()} msgs
              </span>
            </div>
            <div className="mvp-item year2-item">
              <span className="year-tag">{year2}</span>
              <span className="mvp-name">{temporal2.weekday_mvp.contact}</span>
              <span className="mvp-count">
                {temporal2.weekday_mvp.count?.toLocaleString()} msgs
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

