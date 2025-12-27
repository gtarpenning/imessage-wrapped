import { useEnhancement } from "@/hooks/useEnhancement";
import { Histogram } from "@/lib/histogram";

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function formatHour(hour) {
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour} ${period}`;
}

function HourHistogram({ histogram }) {
  // Note: histogram contains hours (0-23) in local timezone, already converted from UTC by analyzer
  const { enhancement } = useEnhancement(null, false);

  const hourHistogramConfig = {
    processData: (histogram) => {
      const buckets = [];
      const maxCount = Math.max(...Object.values(histogram).map(v => parseInt(v, 10)), 0);

      for (let hour = 0; hour < 24; hour++) {
        const count = parseInt(histogram[hour] || histogram[String(hour)] || 0, 10);
        buckets.push({
          hour,
          range: formatHour(hour),
          count,
        });
      }

      return { buckets, maxCount };
    },
    generateTicks: (buckets) => {
      const tickInterval = 4;
      const ticks = [];
      for (let i = 0; i < 24; i += tickInterval) {
        ticks.push(i);
      }
      return ticks;
    },
    formatLabel: (bucket) => bucket.range,
    formatValue: (bucket) => `${bucket.count.toLocaleString()} messages`,
    formatTick: formatHour,
    getBucketKey: (bucket) => bucket.hour,
    formatLargestLabel: (bucket) => `Busiest: ${bucket.range} (${bucket.count.toLocaleString()} messages)`,
  };

  return (
    <Histogram
      histogram={histogram}
      config={hourHistogramConfig}
      title="Messages by Hour"
      enhancement={enhancement}
    />
  );
}

export default function TemporalSection({ temporal }) {
  if (!temporal) return null;

  // Note: temporal data (hours, day of week) is in local timezone, already converted from UTC by analyzer
  return (
    <div className="section">
      <h2 className="section-title">⏰ When You Text</h2>
      {temporal.busiest_day_of_week && (
        <div style={{ marginBottom: "2rem" }}>
          <p style={{ opacity: 0.8 }}>Busiest Day of Week:</p>
          <p style={{ fontSize: "2rem", fontWeight: "bold", color: "#06b6d4" }}>
            {DAY_NAMES[temporal.busiest_day_of_week[0]]} (
            {temporal.busiest_day_of_week[1]} messages)
          </p>
        </div>
      )}

      {temporal.hour_distribution && Object.keys(temporal.hour_distribution).length > 0 && (
        <HourHistogram histogram={temporal.hour_distribution} />
      )}
    </div>
  );
}
