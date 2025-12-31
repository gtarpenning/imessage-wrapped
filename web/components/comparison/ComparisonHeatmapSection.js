"use client";

import { useState } from "react";
import HeatmapSection from "../HeatmapSection";
import ComparisonStatsCard from "./ComparisonStatsCard";

export default function ComparisonHeatmapSection({
  volume1,
  volume2,
  year1,
  year2,
}) {
  const [view, setView] = useState("side-by-side"); // or 'year1', 'year2'

  if (!volume1 || !volume2) return null;

  return (
    <div className="section comparison-heatmap">
      <h2 className="section-title">📅 Activity Comparison</h2>

      <div className="stats-grid">
        <ComparisonStatsCard
          label="Busiest Day Total"
          value1={volume1.busiest_day?.total || 0}
          value2={volume2.busiest_day?.total || 0}
          year1={year1}
          year2={year2}
          suffix="messages"
          higherIsBetter={true}
        />
        <ComparisonStatsCard
          label="Average Messages/Day"
          value1={
            volume1.active_days > 0
              ? Math.round(volume1.total_messages / volume1.active_days)
              : 0
          }
          value2={
            volume2.active_days > 0
              ? Math.round(volume2.total_messages / volume2.active_days)
              : 0
          }
          year1={year1}
          year2={year2}
          higherIsBetter={true}
        />
      </div>

      <div className="view-toggle">
        <button
          className={view === "year1" ? "active" : ""}
          onClick={() => setView("year1")}
        >
          {year1}
        </button>
        <button
          className={view === "side-by-side" ? "active" : ""}
          onClick={() => setView("side-by-side")}
        >
          Both
        </button>
        <button
          className={view === "year2" ? "active" : ""}
          onClick={() => setView("year2")}
        >
          {year2}
        </button>
      </div>

      {view === "side-by-side" && (
        <div className="heatmaps-side-by-side">
          <div className="heatmap-wrapper">
            <h3 className="heatmap-year-label">{year1}</h3>
            <HeatmapSection volume={volume1} year={year1} />
          </div>
          <div className="heatmap-wrapper">
            <h3 className="heatmap-year-label">{year2}</h3>
            <HeatmapSection volume={volume2} year={year2} />
          </div>
        </div>
      )}

      {view === "year1" && <HeatmapSection volume={volume1} year={year1} />}
      {view === "year2" && <HeatmapSection volume={volume2} year={year2} />}
    </div>
  );
}

