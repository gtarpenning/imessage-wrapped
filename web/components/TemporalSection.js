import { Fragment, useMemo, useState } from "react";
import { useEnhancement } from "@/hooks/useEnhancement";
import { Histogram } from "@/lib/histogram";

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

  return (
    <div className="section">
      <h2 className="section-title">⏰ When You Text</h2>
      <WeekdayRadialPlot temporal={temporal} />
      {temporal.hour_distribution && Object.keys(temporal.hour_distribution).length > 0 && (
        <HourHistogram histogram={temporal.hour_distribution} />
      )}
    </div>
  );
}

const DAY_AXIS_CONFIG = [
  { label: "Sun", color: "#fb7185", sourceIndex: 6 },
  { label: "Mon", color: "#f472b6", sourceIndex: 0 },
  { label: "Tue", color: "#c084fc", sourceIndex: 1 },
  { label: "Wed", color: "#a78bfa", sourceIndex: 2 },
  { label: "Thu", color: "#60a5fa", sourceIndex: 3 },
  { label: "Fri", color: "#22d3ee", sourceIndex: 4 },
  { label: "Sat", color: "#14b8a6", sourceIndex: 5 },
];

const DAY_AXIS_DIRECTIONS = DAY_AXIS_CONFIG.map((_, idx) => {
  const angle = (idx / DAY_AXIS_CONFIG.length) * Math.PI * 2 - Math.PI / 2;
  return {
    angle,
    unitX: Math.cos(angle),
    unitY: Math.sin(angle),
  };
});

const SPIDER_MAX_RADIUS = 140;
const SPIDER_GRID_LEVELS = [0.25, 0.5, 0.75, 1];
const SPIDER_LABEL_OFFSET = 32;
const SPIDER_VIEWBOX_SIZE = 440;

function WeekdayRadialPlot({ temporal }) {
  const [tooltip, setTooltip] = useState(null);
  const distribution = useMemo(
    () => temporal.day_of_week_distribution || {},
    [temporal.day_of_week_distribution],
  );
  const { segments, polygonPoints, gridLayers } = useMemo(() => {
    const counts = DAY_AXIS_CONFIG.map(({ sourceIndex }) => {
      const rawValue =
        distribution[sourceIndex] ?? distribution?.[String(sourceIndex)] ?? 0;
      const parsed = typeof rawValue === "number" ? rawValue : Number(rawValue);
      return Number.isFinite(parsed) ? parsed : 0;
    });
    const totalCount = counts.reduce((sum, value) => sum + value, 0);
    const maxValue = counts.reduce((max, value) => Math.max(max, value), 0) || 1;
    const computedSegments = DAY_AXIS_CONFIG.map((config, idx) => {
      const count = counts[idx];
      const direction = DAY_AXIS_DIRECTIONS[idx];
      const ratio = maxValue > 0 ? count / maxValue : 0;
      const radius = ratio * SPIDER_MAX_RADIUS;
      return {
        label: config.label,
        color: config.color,
        count,
        percentOfTotal: totalCount > 0 ? (count / totalCount) * 100 : 0,
        ratio,
        x: direction.unitX * radius,
        y: direction.unitY * radius,
        axisX: direction.unitX * SPIDER_MAX_RADIUS,
        axisY: direction.unitY * SPIDER_MAX_RADIUS,
        labelX: direction.unitX * (SPIDER_MAX_RADIUS + SPIDER_LABEL_OFFSET),
        labelY: direction.unitY * (SPIDER_MAX_RADIUS + SPIDER_LABEL_OFFSET),
        unitX: direction.unitX,
        unitY: direction.unitY,
      };
    });
    const polygonPoints = computedSegments.map((segment) => `${segment.x},${segment.y}`).join(" ");
    const gridLayers = SPIDER_GRID_LEVELS.map((level) => ({
      level,
      points: DAY_AXIS_DIRECTIONS.map(
        (direction) =>
          `${direction.unitX * SPIDER_MAX_RADIUS * level},${direction.unitY * SPIDER_MAX_RADIUS * level}`,
      ).join(" "),
    }));
    return { segments: computedSegments, polygonPoints, gridLayers };
  }, [distribution]);

  const weekdayPercent = temporal.weekday_percentage ?? 0;
  const weekendPercent = temporal.weekend_percentage ?? 0;
  const weekdayMvp = temporal.weekday_mvp;
  const weekendMvp = temporal.weekend_mvp;

  return (
    <div className="temporal-polar-card">
      <div className="temporal-spider-visual" onMouseLeave={() => setTooltip(null)}>
        <svg
          viewBox={`-${SPIDER_VIEWBOX_SIZE / 2} -${SPIDER_VIEWBOX_SIZE / 2} ${SPIDER_VIEWBOX_SIZE} ${SPIDER_VIEWBOX_SIZE}`}
          className="temporal-polar-svg"
        >
          {gridLayers.map((layer) => (
            <polygon key={layer.level} points={layer.points} className="temporal-spider-grid" />
          ))}
          {segments.map((segment) => (
            <line
              key={`${segment.label}-axis`}
              x1="0"
              y1="0"
              x2={segment.axisX}
              y2={segment.axisY}
              className="temporal-spider-axis"
            />
          ))}
          {segments.length > 0 && (
            <polygon points={polygonPoints} className="temporal-spider-shape" />
          )}
          {segments.map((segment) => {
            const showTooltip = () =>
              setTooltip({
                label: segment.label,
                percent: segment.percentOfTotal,
                count: segment.count,
              });
            const labelAnchor =
              Math.abs(segment.unitX) < 0.2 ? "middle" : segment.unitX > 0 ? "start" : "end";
            return (
              <Fragment key={segment.label}>
                <text
                  x={segment.labelX}
                  y={segment.labelY}
                  textAnchor={labelAnchor}
                  dominantBaseline="middle"
                  className="temporal-spider-label"
                >
                  {segment.label}
                </text>
                <g
                  className="temporal-spider-point-wrapper"
                  tabIndex={0}
                  aria-label={`${segment.label}: ${segment.count.toLocaleString()} messages (${segment.percentOfTotal.toFixed(1)}%)`}
                  onMouseEnter={showTooltip}
                  onFocus={showTooltip}
                  onBlur={() => setTooltip(null)}
                  onTouchStart={showTooltip}
                  onTouchEnd={() => setTooltip(null)}
                >
                  <title>
                    {segment.label}: {segment.count.toLocaleString()} messages (
                    {segment.percentOfTotal.toFixed(1)}
                    %)
                  </title>
                  <circle
                    cx={segment.x}
                    cy={segment.y}
                    r="6"
                    fill={segment.color}
                    className="temporal-spider-point"
                  />
                </g>
              </Fragment>
            );
          })}
          <circle cx="0" cy="0" r="26" fill="rgba(7,7,18,0.96)" />
          <text x="0" y="-6" textAnchor="middle" className="temporal-polar-center">
            {tooltip ? tooltip.label : "Weekday"}
          </text>
          <text x="0" y="14" textAnchor="middle" className="temporal-polar-percent">
            {(tooltip?.percent ?? weekdayPercent).toFixed(1)}%
          </text>
        </svg>
        <div className="temporal-polar-tooltip-container">
          {tooltip?.count != null && (
            <div className="temporal-polar-tooltip">
              <strong>{tooltip.label}</strong>
              <span>
                {tooltip.count.toLocaleString()} messages · {tooltip.percent.toFixed(1)}%
              </span>
            </div>
          )}
        </div>
      </div>
      <div className="temporal-polar-blurb">
        <p>
          <span>Weekday:</span> {weekdayPercent.toFixed(1)}%
        </p>
        <p>
          <span>Weekend:</span> {weekendPercent.toFixed(1)}%
        </p>
        {weekdayMvp?.contact && (
          <p>
            <span>Weekday Warrior:</span> {weekdayMvp.contact}
            {weekdayMvp.count != null && ` · ${weekdayMvp.count.toLocaleString?.() || weekdayMvp.count} msgs`}
          </p>
        )}
        {weekendMvp?.contact && (
          <p>
            <span>Weekend MVP:</span> {weekendMvp.contact}
            {weekendMvp.count != null && ` · ${weekendMvp.count.toLocaleString?.() || weekendMvp.count} msgs`}
          </p>
        )}
      </div>
    </div>
  );
}
