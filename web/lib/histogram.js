import { useMemo, useState } from "react";

export function useHistogramData(histogram, config) {
  const { processData, generateTicks } = config;

  return useMemo(() => {
    if (!histogram || typeof histogram !== "object") {
      return { buckets: [], maxCount: 0, ticks: [] };
    }

    const result = processData(histogram);
    const ticks = generateTicks ? generateTicks(result.buckets, result.maxCount) : [];

    return { ...result, ticks };
  }, [histogram, processData, generateTicks]);
}

export function HistogramHeader({ title, enhancement }) {
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
        {title}
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

export function HistogramTooltip({ bucket, position, formatLabel, formatValue }) {
  if (!bucket) return null;

  const label = formatLabel ? formatLabel(bucket) : bucket.range;
  const value = formatValue ? formatValue(bucket) : `${bucket.count.toLocaleString()} messages`;

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
        {label}
      </div>
      <div style={{ opacity: 0.9 }}>
        {value}
      </div>
    </div>
  );
}

export function HistogramBar({ bucket, maxCount, isHovered, onMouseEnter, onMouseLeave, getBarStyle, allBuckets, largestBucket, highlightLargest, getBucketKey }) {
  if (bucket.count === 0) return null;

  const containerHeight = 300;
  const heightPercent = maxCount > 0 ? bucket.count / maxCount : 0;
  const heightPx = Math.max(heightPercent * containerHeight, 2);

  const defaultBackground = "linear-gradient(180deg, rgba(139, 92, 246, 0.6) 0%, rgba(139, 92, 246, 0.3) 100%)";
  const highlightedBackground = "linear-gradient(180deg, #ec4899 0%, #8b5cf6 100%)";
  
  let background = defaultBackground;
  
  if (getBarStyle) {
    background = getBarStyle(bucket, allBuckets);
  } else if (highlightLargest && largestBucket) {
    let isLargest = false;
    if (largestBucket === bucket) {
      isLargest = true;
    } else if (getBucketKey) {
      isLargest = getBucketKey(bucket) === getBucketKey(largestBucket);
    } else {
      isLargest = (
        bucket.hour !== undefined && largestBucket.hour !== undefined && bucket.hour === largestBucket.hour
      ) || (
        bucket.start !== undefined && bucket.end !== undefined &&
        largestBucket.start !== undefined && largestBucket.end !== undefined &&
        bucket.start === largestBucket.start && bucket.end === largestBucket.end
      );
    }
    background = isLargest ? highlightedBackground : defaultBackground;
  }

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

export function HistogramBars({ buckets, maxCount, onBucketHover, hoveredBucket, getBarStyle, getBucketKey, largestBucket, highlightLargest }) {
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
      {buckets.map((bucket, index) => {
        const key = getBucketKey ? getBucketKey(bucket) : index;
        const isHovered = hoveredBucket && getBucketKey 
          ? getBucketKey(hoveredBucket) === key
          : hoveredBucket === bucket;

        return (
          <HistogramBar
            key={key}
            bucket={bucket}
            maxCount={maxCount}
            isHovered={isHovered}
            onMouseEnter={(e) => handleMouseEnter(e, bucket)}
            onMouseLeave={handleMouseLeave}
            getBarStyle={getBarStyle}
            allBuckets={buckets}
            largestBucket={largestBucket}
            highlightLargest={highlightLargest}
            getBucketKey={getBucketKey}
          />
        );
      })}
    </div>
  );
}

export function HistogramAxis({ buckets, ticks, formatTick, renderExtra, largestBucket, formatLargestLabel, highlightLargest }) {
  if (buckets.length === 0 || !ticks) return null;

  return (
    <div
      style={{
        position: "relative",
        height: "40px",
        marginTop: "0.5rem",
      }}
    >
      {ticks.map((tick) => {
        const bucketIndex = buckets.findIndex((b) => {
          if (b.hour !== undefined) return b.hour === tick;
          if (b.start !== undefined && b.end !== undefined) {
            return tick >= b.start && tick <= b.end;
          }
          return false;
        });
        const position = bucketIndex >= 0 ? ((bucketIndex + 0.5) / buckets.length) * 100 : 0;
        const label = formatTick ? formatTick(tick) : tick;

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
            {label}
          </div>
        );
      })}
      {renderExtra && renderExtra(buckets)}
      {highlightLargest && largestBucket && largestBucket.count > 0 && (
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
          {formatLargestLabel ? formatLargestLabel(largestBucket) : `Busiest: ${largestBucket.range} (${largestBucket.count.toLocaleString()} messages)`}
        </div>
      )}
    </div>
  );
}

export function Histogram({
  histogram,
  config,
  title,
  enhancement,
  containerStyle,
  highlightLargest = true,
}) {
  const [hoveredBucket, setHoveredBucket] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const histogramData = useHistogramData(histogram, config);

  const largestBucket = useMemo(() => {
    if (!histogramData.buckets || histogramData.buckets.length === 0) return null;
    return histogramData.buckets.reduce((max, bucket) => 
      bucket.count > max.count ? bucket : max, histogramData.buckets[0]
    );
  }, [histogramData.buckets]);

  const handleBucketHover = (bucket, position) => {
    setHoveredBucket(bucket);
    setTooltipPosition(position);
  };

  const defaultContainerStyle = {
    background: "rgba(255, 255, 255, 0.05)",
    borderRadius: "16px",
    padding: "2rem",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    maxWidth: "1200px",
    margin: "0 auto",
  };

  const effectiveHighlightLargest = highlightLargest && !config.getBarStyle;

  return (
    <div style={{ marginTop: "2rem" }}>
      <HistogramHeader title={title} enhancement={enhancement} />

      <div style={{ ...defaultContainerStyle, ...containerStyle }}>
        <div style={{ position: "relative" }}>
          {config.renderYAxis &&
            config.renderYAxis(histogramData.buckets, histogramData.maxCount)}
          <HistogramTooltip 
            bucket={hoveredBucket} 
            position={tooltipPosition}
            formatLabel={config.formatLabel}
            formatValue={config.formatValue}
          />
          <HistogramBars
            buckets={histogramData.buckets}
            maxCount={histogramData.maxCount}
            onBucketHover={handleBucketHover}
            hoveredBucket={hoveredBucket}
            getBarStyle={config.getBarStyle}
            getBucketKey={config.getBucketKey}
            largestBucket={effectiveHighlightLargest ? largestBucket : null}
            highlightLargest={effectiveHighlightLargest}
          />
        </div>

        <HistogramAxis
          buckets={histogramData.buckets}
          ticks={histogramData.ticks}
          formatTick={config.formatTick}
          renderExtra={config.renderExtra}
          largestBucket={effectiveHighlightLargest ? largestBucket : null}
          formatLargestLabel={config.formatLargestLabel}
          highlightLargest={effectiveHighlightLargest}
        />
      </div>
    </div>
  );
}
