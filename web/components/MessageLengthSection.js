import StatCard from "./StatCard";
import { useEnhancement, PLAYFUL_INSTRUCTION } from "@/hooks/useEnhancement";
import { useMemo, useState } from "react";

export default function MessageLengthSection({ content }) {
  if (!content) return null;

  const hasLengthData =
    content.avg_message_length_sent !== undefined ||
    content.avg_message_length_received !== undefined;

  if (!hasLengthData) return null;

  return (
    <div className="section">
      <h2 className="section-title">📏 Message Length</h2>

      <div className="stats-grid">
        {content.avg_message_length_sent !== undefined && (
          <StatCard
            label="Avg Length (Sent)"
            value={`${Math.round(content.avg_message_length_sent)} chars`}
            valueStyle={{ fontSize: "2rem" }}
          />
        )}
        {content.avg_message_length_received !== undefined && (
          <StatCard
            label="Avg Length (Received)"
            value={`${Math.round(content.avg_message_length_received)} chars`}
            valueStyle={{ fontSize: "2rem" }}
          />
        )}
        {content.avg_word_count_sent !== undefined && (
          <StatCard
            label="Avg Words (Sent)"
            value={`${Math.round(content.avg_word_count_sent)} words`}
            valueStyle={{ fontSize: "2rem" }}
          />
        )}
      </div>

      {content.word_count_histogram && Object.keys(content.word_count_histogram).length > 0 && (
        <WordCountHistogram
          histogram={content.word_count_histogram}
          modeWordCount={content.mode_word_count}
        />
      )}
    </div>
  );
}

function useHistogramData(histogram) {
  return useMemo(() => {
    if (!histogram || typeof histogram !== "object") {
      return { buckets: [], maxCount: 0, ticks: [] };
    }

    const entries = Object.entries(histogram)
      .map(([wordCount, count]) => [parseInt(wordCount, 10), parseInt(count, 10)])
      .filter(([wordCount, count]) => !isNaN(wordCount) && !isNaN(count) && count > 0);

    if (entries.length === 0) {
      return { buckets: [], maxCount: 0, ticks: [] };
    }

    entries.sort((a, b) => a[0] - b[0]);

    const counts = entries.map(([, count]) => count);
    const wordCounts = entries.map(([wordCount]) => wordCount);
    const maxCount = Math.max(...counts);
    const actualMaxWordCount = Math.max(...wordCounts);
    const cappedMaxWordCount = 60;

    if (maxCount === 0 || actualMaxWordCount === 0) {
      return { buckets: [], maxCount: 0, ticks: [] };
    }

    const buckets = [];
    const numBuckets = 60;
    const bucketSize = 1;

    for (let i = 1; i <= cappedMaxWordCount; i += bucketSize) {
      const bucketEnd = i;
      let bucketCount = 0;
      for (const [wordCount, count] of entries) {
        if (wordCount === i) {
          bucketCount += count;
        }
      }
      buckets.push({
        range: `${i}`,
        start: i,
        end: bucketEnd,
        count: bucketCount,
      });
    }

    if (actualMaxWordCount > cappedMaxWordCount) {
      let overflowCount = 0;
      for (const [wordCount, count] of entries) {
        if (wordCount > cappedMaxWordCount) {
          overflowCount += count;
        }
      }
      if (overflowCount > 0) {
        buckets.push({
          range: "60+",
          start: cappedMaxWordCount + 1,
          end: actualMaxWordCount,
          count: overflowCount,
        });
      }
    }

    const maxBucketCount = Math.max(...buckets.map(b => b.count), 0);
    
    const tickInterval = 10;
    const ticks = [];
    const hasOverflow = actualMaxWordCount > cappedMaxWordCount;
    const maxTick = hasOverflow ? cappedMaxWordCount - tickInterval : cappedMaxWordCount;
    
    for (let i = 10; i <= maxTick; i += tickInterval) {
      ticks.push(i);
    }
    if (!hasOverflow) {
      ticks.push(cappedMaxWordCount);
    }

    return { buckets, maxCount: maxBucketCount || maxCount, ticks, maxWordCount: actualMaxWordCount };
  }, [histogram]);
}

function HistogramHeader({ enhancement }) {
  return (
    <div style={{ marginTop: "2rem" }}>
      <h3
        style={{
          textAlign: "center",
          fontSize: "1.5rem",
          marginBottom: enhancement ? "0.5rem" : "1.5rem",
          opacity: 0.85,
        }}
      >
        Message Length Distribution
      </h3>
      {enhancement && (
        <p
          style={{
            marginTop: "0",
            marginBottom: "1.5rem",
            fontSize: "1.5rem",
            fontWeight: "500",
            opacity: 0.85,
            fontStyle: "italic",
            textAlign: "center",
            lineHeight: "1.4",
          }}
        >
          {enhancement}
        </p>
      )}
    </div>
  );
}

function HistogramTooltip({ bucket, position }) {
  if (!bucket) return null;

  return (
    <div
      style={{
        position: "absolute",
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: "translateX(-50%)",
        background: "rgba(0, 0, 0, 0.9)",
        color: "white",
        padding: "0.5rem 0.75rem",
        borderRadius: "8px",
        fontSize: "0.875rem",
        whiteSpace: "nowrap",
        zIndex: 1000,
        pointerEvents: "none",
        border: "1px solid rgba(255, 255, 255, 0.2)",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
      }}
    >
      <div style={{ fontWeight: "600", marginBottom: "0.25rem" }}>
        {bucket.range} words
      </div>
      <div style={{ opacity: 0.9 }}>
        {bucket.count.toLocaleString()} messages
      </div>
    </div>
  );
}

function HistogramBar({ bucket, maxCount, modeWordCount, isHovered, onMouseEnter, onMouseLeave }) {
  if (bucket.count === 0) return null;

  const containerHeight = 300;
  const heightPercent = maxCount > 0 ? bucket.count / maxCount : 0;
  const heightPx = Math.max(heightPercent * containerHeight, 2);

  const isModeBucket = modeWordCount >= bucket.start && modeWordCount <= bucket.end;
  const background = isModeBucket
    ? "linear-gradient(180deg, #ec4899 0%, #8b5cf6 100%)"
    : "linear-gradient(180deg, rgba(139, 92, 246, 0.6) 0%, rgba(139, 92, 246, 0.3) 100%)";

  return (
    <div
      style={{
        flex: "1",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-end",
        minWidth: "8px",
        height: "100%",
      }}
    >
      <div
        style={{
          width: "100%",
          height: `${heightPx}px`,
          minHeight: "2px",
          background,
          borderRadius: "4px 4px 0 0",
          transition: "all 0.3s ease",
          cursor: "pointer",
          opacity: isHovered ? 0.8 : 1,
        }}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      />
    </div>
  );
}

function HistogramBars({ buckets, maxCount, modeWordCount, onBucketHover, hoveredBucket }) {
  const handleMouseEnter = (e, bucket) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const container = e.currentTarget.closest('[style*="position: relative"]');
    if (container) {
      const containerRect = container.getBoundingClientRect();
      onBucketHover(bucket, {
        x: rect.left + rect.width / 2 - containerRect.left,
        y: rect.top - containerRect.top - 10,
      });
    }
  };

  const handleMouseLeave = () => {
    onBucketHover(null, { x: 0, y: 0 });
  };

  if (buckets.length === 0) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          opacity: 0.5,
        }}
      >
        No data available
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        gap: "4px",
        height: "300px",
        marginBottom: "1rem",
      }}
    >
      {buckets.map((bucket, index) => (
        <HistogramBar
          key={index}
          bucket={bucket}
          maxCount={maxCount}
          modeWordCount={modeWordCount}
          isHovered={hoveredBucket?.start === bucket.start}
          onMouseEnter={(e) => handleMouseEnter(e, bucket)}
          onMouseLeave={handleMouseLeave}
        />
      ))}
    </div>
  );
}

function HistogramAxis({ buckets, ticks, modeWordCount }) {
  if (buckets.length === 0 || !ticks) return null;

  const hasOverflowBucket = buckets.some(b => b.range === "60+");
  const lastBucketIndex = buckets.length - 1;

  return (
    <div
      style={{
        position: "relative",
        height: "40px",
        marginTop: "0.5rem",
      }}
    >
      {ticks.map((tick) => {
        const bucketIndex = buckets.findIndex((b) => tick >= b.start && tick <= b.end);
        const position = bucketIndex >= 0 ? ((bucketIndex + 0.5) / buckets.length) * 100 : 0;

        return (
          <div
            key={tick}
            style={{
              position: "absolute",
              left: `${position}%`,
              transform: "translateX(-50%)",
              fontSize: "0.75rem",
              opacity: 0.6,
              whiteSpace: "nowrap",
            }}
          >
            {tick}
          </div>
        );
      })}
      {hasOverflowBucket && (
        <div
          style={{
            position: "absolute",
            left: `${((lastBucketIndex + 0.5) / buckets.length) * 100}%`,
            transform: "translateX(-50%)",
            fontSize: "0.75rem",
            opacity: 0.6,
            whiteSpace: "nowrap",
          }}
        >
          60+
        </div>
      )}
      {modeWordCount !== undefined && modeWordCount !== null && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            transform: "translateX(-50%)",
            fontSize: "0.75rem",
            opacity: 0.8,
            fontWeight: "500",
            top: "20px",
            whiteSpace: "nowrap",
          }}
        >
          Mode: {modeWordCount} words
        </div>
      )}
    </div>
  );
}

function WordCountHistogram({ histogram, modeWordCount }) {
  const [hoveredBucket, setHoveredBucket] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const histogramData = useHistogramData(histogram);

  const prompt = modeWordCount
    ? `Your most common message length is ${modeWordCount} words. Categorize this messaging style with a playful category name like (doesn't have to be exact) "sniper" (1-5 words), "conversationalist" (6-15 words), "essayist" (50+ words), etc. ${PLAYFUL_INSTRUCTION}`
    : null;

  const { enhancement } = useEnhancement(prompt, !!prompt);

  const handleBucketHover = (bucket, position) => {
    setHoveredBucket(bucket);
    setTooltipPosition(position);
  };

  return (
    <div style={{ marginTop: "2rem" }}>
      <HistogramHeader enhancement={enhancement} />

      <div
        style={{
          background: "rgba(255, 255, 255, 0.05)",
          borderRadius: "16px",
          padding: "2rem",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          maxWidth: "1200px",
          margin: "0 auto",
        }}
      >
        <div style={{ position: "relative" }}>
          <HistogramTooltip bucket={hoveredBucket} position={tooltipPosition} />
          <HistogramBars
            buckets={histogramData.buckets}
            maxCount={histogramData.maxCount}
            modeWordCount={modeWordCount}
            onBucketHover={handleBucketHover}
            hoveredBucket={hoveredBucket}
          />
        </div>

        <HistogramAxis
          buckets={histogramData.buckets}
          ticks={histogramData.ticks}
          modeWordCount={modeWordCount}
        />
      </div>
    </div>
  );
}
