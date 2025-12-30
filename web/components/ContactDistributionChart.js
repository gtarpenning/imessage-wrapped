import { useState } from "react";
import { PieChart, extractColorFromGradient } from "@/lib/pieChart";
import { getWarmColorGradient } from "@/lib/histogram";

const clamp01 = (value) => Math.max(0, Math.min(1, value));

function getCoolColorGradient(value) {
  const normalized = clamp01(value);
  const start = { r: 56, g: 189, b: 248 }; // sky-400-ish
  const end = { r: 99, g: 102, b: 241 }; // indigo-500-ish
  const r = Math.round(start.r + (end.r - start.r) * normalized);
  const g = Math.round(start.g + (end.g - start.g) * normalized);
  const b = Math.round(start.b + (end.b - start.b) * normalized);
  return `linear-gradient(180deg, rgba(${r},${g},${b},0.95) 0%, rgba(${r},${g},${b},0.6) 100%)`;
}

function createPieChartConfig(distribution, onSegmentHover, hoveredSegmentKey) {
  const top20 = distribution.slice(0, 20);
  const rest = distribution.slice(20);
  const restCount = rest.reduce((sum, entry) => sum + (entry.count ?? 0), 0);
  const restSent = rest.reduce((sum, entry) => sum + (entry.sent_count ?? 0), 0);
  const restReceived = rest.reduce(
    (sum, entry) => sum + (entry.received_count ?? 0),
    0,
  );
  const normalizeRatios = (entry, messageCount) => {
    const sentCount = entry.sent_count ?? entry.sentCount ?? 0;
    const receivedCount = entry.received_count ?? entry.receivedCount ?? 0;
    const sentRatioFromEntry = typeof entry.sent_ratio === "number" ? entry.sent_ratio : null;
    const receivedRatioFromEntry =
      typeof entry.received_ratio === "number" ? entry.received_ratio : null;

    let sentRatio = sentRatioFromEntry;
    let receivedRatio = receivedRatioFromEntry;

    if (sentRatio === null && receivedRatio !== null) {
      sentRatio = Math.max(0, 1 - receivedRatio);
    } else if (receivedRatio === null && sentRatio !== null) {
      receivedRatio = Math.max(0, 1 - sentRatio);
    }

    if (sentRatio === null && receivedRatio === null) {
      const totalCount = sentCount + receivedCount;
      if (totalCount > 0) {
        sentRatio = sentCount / totalCount;
        receivedRatio = receivedCount / totalCount;
      } else if (messageCount > 0) {
        sentRatio = 0.5;
        receivedRatio = 0.5;
      }
    }

    sentRatio = sentRatio ?? 0;
    receivedRatio = receivedRatio ?? 0;

    const ratioTotal = sentRatio + receivedRatio;
    if (ratioTotal === 0) {
      sentRatio = 0.5;
      receivedRatio = 0.5;
    } else if (ratioTotal !== 1) {
      sentRatio = sentRatio / ratioTotal;
      receivedRatio = receivedRatio / ratioTotal;
    }

    return {
      sentCount,
      receivedCount,
      sentRatio,
      receivedRatio,
    };
  };
  const getRatios = (segment) => {
    const sentRatio = typeof segment.sentRatio === "number" ? segment.sentRatio : 0.5;
    const receivedRatio =
      typeof segment.receivedRatio === "number" ? segment.receivedRatio : 1 - sentRatio;
    const ratioTotal = sentRatio + receivedRatio;
    const normalizedSent = ratioTotal > 0 ? sentRatio / ratioTotal : 0.5;
    const normalizedReceived = ratioTotal > 0 ? receivedRatio / ratioTotal : 0.5;

    return {
      sentPct: Math.round(normalizedSent * 100),
      receivedPct: Math.round(normalizedReceived * 100),
      sentRatio: normalizedSent,
      receivedRatio: normalizedReceived,
    };
  };
  const renderSentReceivedBar = (segment, opts = {}) => {
    const { sentPct, receivedPct, sentRatio, receivedRatio } = getRatios(segment);
    const sentGradient = getWarmColorGradient(sentRatio, 1);
    const receivedGradient = opts.receivedColor || getCoolColorGradient(receivedRatio);
    const sentSolid = extractColorFromGradient(sentGradient);
    const receivedSolid = extractColorFromGradient(receivedGradient);
    const showCounts = opts.showCounts || false;
    const sentCountDisplay =
      typeof segment.sentCount === "number" ? segment.sentCount.toLocaleString() : null;
    const receivedCountDisplay =
      typeof segment.receivedCount === "number" ? segment.receivedCount.toLocaleString() : null;

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", width: "100%" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            width: "100%",
          }}
        >
          <div
            style={{
              flex: 1,
              height: "8px",
              borderRadius: "999px",
              background: "rgba(255, 255, 255, 0.12)",
              overflow: "hidden",
              display: "flex",
            }}
          >
            <div
              style={{
                width: `${sentPct}%`,
                background: sentGradient,
                transition: "width 0.2s ease",
              }}
            />
            <div
              style={{
                width: `${Math.max(receivedPct, 0)}%`,
                background: receivedGradient,
                transition: "width 0.2s ease",
              }}
            />
          </div>
          <div
            style={{
              display: "flex",
              gap: "0.35rem",
              fontSize: "0.75rem",
              opacity: 0.85,
              whiteSpace: "nowrap",
            }}
          >
            <span style={{ color: sentSolid }}>Sent {sentPct}%</span>
            <span style={{ color: receivedSolid }}>Recv {receivedPct}%</span>
          </div>
        </div>
        {showCounts && (sentCountDisplay !== null || receivedCountDisplay !== null) && (
          <div
            style={{
              display: "flex",
              gap: "0.75rem",
              fontSize: "0.8rem",
              opacity: 0.85,
            flexWrap: "wrap",
          }}
        >
          {sentCountDisplay !== null && (
            <span style={{ color: sentSolid }}>Sent {sentCountDisplay}</span>
          )}
          {receivedCountDisplay !== null && (
            <span style={{ color: receivedSolid }}>Recv {receivedCountDisplay}</span>
          )}
        </div>
      )}
    </div>
  );
  };
  
  return {
    processData: () => {
      const segments = top20.map((entry, index) => {
        const share = entry.share ?? 0;
        const messageCount = entry.count ?? 0;
        const { sentCount, receivedCount, sentRatio, receivedRatio } = normalizeRatios(
          entry,
          messageCount,
        );
        return {
          rank: entry.rank ?? index + 1,
          share,
          messageCount,
          sentCount,
          receivedCount,
          sentRatio,
          receivedRatio,
          contactName: entry.contact_name,
        };
      });
      
      let top20TotalShare = segments.reduce((sum, s) => sum + (s.share ?? 0), 0);
      
      if (top20TotalShare > 1) {
        const scaleFactor = 1 / top20TotalShare;
        segments.forEach(s => {
          s.share = s.share * scaleFactor;
        });
        top20TotalShare = 1;
      }
      
      const normalizedRestShare = Math.max(0, 1 - top20TotalShare);
      
      if (normalizedRestShare > 0 && restCount > 0) {
        const { sentCount, receivedCount, sentRatio, receivedRatio } = normalizeRatios(
          {
            sent_count: restSent,
            received_count: restReceived,
          },
          restCount,
        );
        segments.push({
          rank: "rest",
          share: normalizedRestShare,
          messageCount: restCount,
          sentCount,
          receivedCount,
          sentRatio,
          receivedRatio,
          contactName: "The Rest",
          isRest: true,
        });
      }
      
      return segments;
    },
    formatLabel: (segment) => {
      if (segment.contactName) {
        return segment.contactName;
      }
      return `Chat #${String(segment.rank).padStart(2, "0")}`;
    },
    formatValue: (segment) => {
      const percentage = Math.round((segment.share ?? 0) * 100);
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
          <div style={{ opacity: 0.9 }}>
            {percentage}% share · {segment.messageCount.toLocaleString()} msgs
          </div>
          {renderSentReceivedBar(segment, { showCounts: true })}
        </div>
      );
    },
    getSegmentKey: (segment) => segment.rank,
    getSegmentColor: (item, allItems, index) => {
      if (item.isRest) {
        return "linear-gradient(135deg, rgba(40, 30, 50, 0.6) 0%, rgba(50, 35, 60, 0.6) 50%, rgba(40, 30, 55, 0.6) 100%)";
      }
      const nonRestItems = allItems.filter(i => !i.isRest);
      const maxShare = Math.max(...nonRestItems.map(i => i.share ?? 0), 0);
      return getWarmColorGradient(item.share ?? 0, maxShare);
    },
    renderLegend: (segments, hoveredSegmentKey, onSegmentHover) => {
      const itemHeight = 72;
      const visibleItems = 5;
      const maxHeight = itemHeight * visibleItems;
      
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
            width: "100%",
            maxWidth: "500px",
          }}
        >
          <div
            style={{
              fontSize: "0.875rem",
              opacity: 0.7,
              textAlign: "center",
              marginBottom: "0.5rem",
              fontWeight: "500",
            }}
          >
            Top chats by message count
          </div>
          <div
            style={{
              maxHeight: `${maxHeight}px`,
              overflowY: "auto",
              overflowX: "hidden",
              paddingRight: "0.5rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
            }}
            className="heatmap-scroll"
          >
            {segments.map((segment) => {
            const percentage = Math.round((segment.share ?? 0) * 100);
            const label = segment.contactName || `Chat #${String(segment.rank).padStart(2, "0")}`;
            const isHovered = hoveredSegmentKey === segment.rank;
            const segmentKey = segment.rank;
            
            return (
              <div
                key={segment.rank}
                onMouseEnter={() => onSegmentHover && onSegmentHover(segmentKey)}
                onMouseLeave={() => onSegmentHover && onSegmentHover(null)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  fontSize: "0.875rem",
                  padding: "0.5rem",
                  borderRadius: "8px",
                  background: isHovered ? "rgba(255, 255, 255, 0.1)" : "rgba(255, 255, 255, 0.03)",
                  border: isHovered ? "1px solid rgba(255, 255, 255, 0.2)" : "1px solid transparent",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
              >
                <div
                  style={{
                    width: "12px",
                    height: "12px",
                    borderRadius: "3px",
                    background: extractColorFromGradient(segment.color),
                    flexShrink: 0,
                    opacity: isHovered ? 1 : 0.9,
                    transition: "opacity 0.2s ease",
                  }}
                />
                <div style={{ flex: 1, opacity: isHovered ? 1 : 0.9 }}>{label}</div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.35rem" }}>
                  <div style={{ opacity: 0.7, fontWeight: "500", marginRight: "0.5rem" }}>
                    {percentage}%
                  </div>
                  <div style={{ opacity: 0.6, fontSize: "0.8rem" }}>
                    {segment.messageCount.toLocaleString()} msgs
                  </div>
                  <div style={{ width: "210px" }}>
                    {renderSentReceivedBar(segment, { receivedColor: "rgba(255,255,255,0.7)" })}
                  </div>
                </div>
              </div>
            );
          })}
          </div>
        </div>
      );
    },
  };
}

export default function ContactDistributionChart({ distribution }) {
  const [hoveredSegmentKey, setHoveredSegmentKey] = useState(null);
  
  if (!distribution || distribution.length === 0) return null;

  const config = createPieChartConfig(distribution, setHoveredSegmentKey, hoveredSegmentKey);
  
  const legendWithHover = (segments, hoveredSegmentKeyParam, onSegmentHoverParam) => {
    return config.renderLegend(segments, hoveredSegmentKeyParam || hoveredSegmentKey, onSegmentHoverParam || setHoveredSegmentKey);
  };

  return (
    <PieChart
      data={distribution}
      config={{
        ...config,
        renderLegend: legendWithHover,
      }}
      title="Chat Concentration"
      onSegmentHover={setHoveredSegmentKey}
      hoveredSegmentKey={hoveredSegmentKey}
    />
  );
}
