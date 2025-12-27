import { Histogram } from "@/lib/histogram";

function createHistogramConfig(distribution) {
  const capped = distribution.slice(0, 20);
  return {
    processData: () => {
      const buckets = capped.map((entry, index) => {
        const share = entry.share ?? 0;
        return {
          rank: entry.rank ?? index + 1,
          count: share,
          share,
          messageCount: entry.count ?? 0,
        };
      });
      const maxShare = buckets.reduce(
        (max, bucket) => Math.max(max, bucket.share ?? 0),
        0,
      );
      return { buckets, maxCount: maxShare || 1 };
    },
    generateTicks: () => [],
    formatLabel: (bucket) => `Chat #${String(bucket.rank).padStart(2, "0")}`,
    formatValue: (bucket) =>
      `${Math.round((bucket.share ?? 0) * 100)}% share · ${bucket.messageCount.toLocaleString()} msgs`,
    getBucketKey: (bucket) => bucket.rank,
    getBarStyle: (bucket) => {
      const intensity = bucket.share ?? 0;
      const hueStart = 280;
      const hueEnd = 330;
      const hue = hueStart + (hueEnd - hueStart) * intensity;
      return `linear-gradient(180deg, hsla(${hue}, 85%, 65%, 0.9) 0%, hsla(${hue}, 85%, 45%, 0.35) 100%)`;
    },
    renderYAxis: (buckets, maxCount) => {
      const fractions = [1, 0.75, 0.5, 0.25, 0];
      return (
        <div
          style={{
            position: "absolute",
            left: "-2.5rem",
            top: 0,
            bottom: 0,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            fontSize: "0.75rem",
            opacity: 0.55,
          }}
        >
          {fractions.map((fraction) => {
            const value = (maxCount || 1) * fraction;
            return (
              <span key={fraction}>{Math.round(value * 100)}%</span>
            );
          })}
        </div>
      );
    },
    highlightLargest: false,
  };
}

export default function ContactDistributionChart({ distribution }) {
  if (!distribution || distribution.length === 0) return null;

  return (
    <Histogram
      histogram={distribution}
      config={createHistogramConfig(distribution)}
      title="Chat Concentration"
      containerStyle={{
        paddingLeft: "3.5rem",
        paddingRight: "1.5rem",
      }}
      highlightLargest={false}
    />
  );
}
