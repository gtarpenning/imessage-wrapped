import { useState } from "react";
import { PieChart, extractColorFromGradient } from "@/lib/pieChart";
import { getWarmColorGradient } from "@/lib/histogram";

function createPieChartConfig(distribution, onSegmentHover, hoveredSegmentKey) {
  const top20 = distribution.slice(0, 20);
  const rest = distribution.slice(20);
  const restShare = rest.reduce((sum, entry) => sum + (entry.share ?? 0), 0);
  const restCount = rest.reduce((sum, entry) => sum + (entry.count ?? 0), 0);
  
  return {
    processData: () => {
      const segments = top20.map((entry, index) => {
        const share = entry.share ?? 0;
        return {
          rank: entry.rank ?? index + 1,
          share,
          messageCount: entry.count ?? 0,
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
        segments.push({
          rank: "rest",
          share: normalizedRestShare,
          messageCount: restCount,
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
      return `${percentage}% share · ${segment.messageCount.toLocaleString()} msgs`;
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
      const itemHeight = 48;
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
                <div style={{ opacity: 0.7, fontWeight: "500", marginRight: "0.5rem" }}>
                  {percentage}%
                </div>
                <div style={{ opacity: 0.6, fontSize: "0.8rem" }}>
                  {segment.messageCount.toLocaleString()} msgs
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
