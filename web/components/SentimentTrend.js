import { Histogram } from "@/lib/histogram";
import { useMemo } from "react";
import React from "react";

function formatMonthLabel(period, showYear = false) {
  if (!period) return "";
  const [year, month] = period.split("-");
  if (!year || !month) return period;
  const monthLabel = new Date(`${period}-01`).toLocaleString("default", {
    month: "short",
  });
  return showYear ? `${monthLabel} ${year}` : monthLabel;
}

function getScoreBasedColorGradient(score, minScore, maxScore) {
  const range = maxScore - minScore;
  const normalized = range > 0 ? Math.max(0, Math.min(1, (score - minScore) / range)) : 0;
  const warmColors = [
    { r: 251, g: 191, b: 36 },
    { r: 251, g: 113, b: 133 },
    { r: 236, g: 72, b: 153 },
    { r: 219, g: 39, b: 119 },
  ];
  const colorIndex = Math.floor(normalized * (warmColors.length - 1));
  const nextIndex = Math.min(colorIndex + 1, warmColors.length - 1);
  const t = normalized * (warmColors.length - 1) - colorIndex;
  const c1 = warmColors[colorIndex];
  const c2 = warmColors[nextIndex];
  const r = Math.round(c1.r + (c2.r - c1.r) * t);
  const g = Math.round(c1.g + (c2.g - c1.g) * t);
  const b = Math.round(c1.b + (c2.b - c1.b) * t);
  return `linear-gradient(180deg, rgba(${r},${g},${b},0.9) 0%, rgba(${r},${g},${b},0.4) 100%)`;
}

export default function SentimentTrend({ sentiment }) {
  const periods = sentiment?.periods?.overall;

  const sorted = useMemo(() => {
    if (!periods || periods.length === 0) return [];
    
    const parsed = periods.map((entry) => {
      const [year, month] = entry.period.split("-").map(Number);
      return { ...entry, year, month };
    });
    
    const maxYear = Math.max(...parsed.map((p) => p.year));
    const filtered = parsed.filter((p) => p.year === maxYear);
    
    return filtered.sort((a, b) => a.month - b.month);
  }, [periods]);

  const scores = useMemo(() => {
    if (!sorted || sorted.length === 0) return [];
    return sorted.map((entry) => entry.avg_score ?? 0);
  }, [sorted]);

  const minScore = scores.length > 0 ? Math.min(...scores) : 0;
  const maxScore = scores.length > 0 ? Math.max(...scores) : 0;

  const histogramConfig = useMemo(() => {
    if (!sorted || sorted.length === 0) return null;
    const offset = minScore < 0 ? Math.abs(minScore) : 0;
    
    return {
      processData: () => {
        const buckets = sorted.map((entry) => {
          const score = entry.avg_score ?? 0;
          return {
            period: entry.period,
            score,
            count: score + offset,
          };
        });
        const maxCount = Math.max(...buckets.map((b) => b.count), 0);
        return { buckets, maxCount: maxCount || 1 };
      },
      generateTicks: () => [],
      formatLabel: (bucket) => formatMonthLabel(bucket.period),
      formatValue: (bucket) => {
        const score = bucket.score ?? 0;
        return `Sentiment: ${score >= 0 ? "+" : ""}${score.toFixed(2)}`;
      },
      formatTick: formatMonthLabel,
      getBucketKey: (bucket) => bucket.period,
      getBarStyle: (bucket) => {
        return getScoreBasedColorGradient(bucket.score, minScore, maxScore);
      },
      renderExtra: (buckets) => {
        return (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              width: "100%",
              marginTop: "0.5rem",
            }}
          >
            {buckets.map((bucket, index) => {
              const position = ((index + 0.5) / buckets.length) * 100;
              return (
                <div
                  key={bucket.period}
                  style={{
                    position: "absolute",
                    left: `${position}%`,
                    transform: "translateX(-50%)",
                    fontSize: "0.75rem",
                    opacity: 0.6,
                    whiteSpace: "nowrap",
                    textAlign: "center",
                  }}
                >
                  {formatMonthLabel(bucket.period)}
                </div>
              );
            })}
          </div>
        );
      },
      highlightLargest: false,
    };
  }, [sorted, minScore, maxScore]);

  if (!periods || periods.length === 0 || sorted.length === 0) return null;

  const average = sentiment?.overall?.avg_score ?? 0;
  const enhancement = `Average sentiment: ${average >= 0 ? "+" : ""}${average.toFixed(2)}`;

  return (
    <Histogram
      histogram={sentiment}
      config={histogramConfig}
      title="Monthly Mood"
      enhancement={enhancement}
      containerStyle={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    />
  );
}
