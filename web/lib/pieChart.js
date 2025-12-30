import { useState, useMemo } from "react";
import { getWarmColorGradient } from "./histogram";
import EnhancedText from "@/components/EnhancedText";

export function extractColorFromGradient(gradient) {
  if (!gradient || typeof gradient !== "string") {
    return "#8b5cf6";
  }
  
  if (gradient.startsWith("linear-gradient")) {
    const rgbaMatch = gradient.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*[\d.]+\)/);
    if (rgbaMatch) {
      const [, r, g, b] = rgbaMatch;
      return `rgb(${r}, ${g}, ${b})`;
    }
  }
  
  if (gradient.startsWith("rgba(")) {
    const rgbaMatch = gradient.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*[\d.]+\)/);
    if (rgbaMatch) {
      const [, r, g, b, a] = rgbaMatch;
      return `rgba(${r}, ${g}, ${b}, ${a})`;
    }
  }
  
  if (gradient.startsWith("#") || gradient.startsWith("rgb")) {
    return gradient;
  }
  
  return "#8b5cf6";
}

export function PieChartHeader({ title, enhancement }) {
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
        <EnhancedText style={{ marginBottom: "1.5rem" }}>
          {enhancement}
        </EnhancedText>
      )}
    </div>
  );
}

export function PieChartTooltip({ segment, position, formatLabel, formatValue }) {
  if (!segment) return null;

  const label = formatLabel ? formatLabel(segment) : segment.label || "Unknown";
  const value = formatValue ? formatValue(segment) : `${(segment.share * 100).toFixed(1)}%`;

  return (
    <div
      style={{
        position: "fixed",
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: "translateX(-50%)",
        background: "rgba(0, 0, 0, 0.9)",
        color: "white",
        padding: "0.5rem 0.75rem",
        borderRadius: "8px",
        fontSize: "0.875rem",
        whiteSpace: "normal",
        maxWidth: "340px",
        zIndex: 10000,
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

function PieSlice({ segment, index, totalSegments, onMouseEnter, onMouseLeave, isHovered }) {
  const { startAngle, endAngle, color, share } = segment;
  
  const size = 280;
  const center = size / 2;
  const radius = size / 2 - 10;
  const hoverRadius = isHovered ? radius + 8 : radius;
  
  const largeArcFlag = endAngle - startAngle > Math.PI ? 1 : 0;
  
  const x1 = center + hoverRadius * Math.cos(startAngle);
  const y1 = center + hoverRadius * Math.sin(startAngle);
  const x2 = center + hoverRadius * Math.cos(endAngle);
  const y2 = center + hoverRadius * Math.sin(endAngle);
  
  const pathData = [
    `M ${center} ${center}`,
    `L ${x1} ${y1}`,
    `A ${hoverRadius} ${hoverRadius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
    "Z"
  ].join(" ");
  
  const midAngle = (startAngle + endAngle) / 2;
  const gradientId = `gradient-${segment.index}`;
  
  if (color.startsWith("linear-gradient")) {
    const rgbaMatches = color.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/g);
    if (rgbaMatches && rgbaMatches.length >= 2) {
      const startMatch = rgbaMatches[0].match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
      const endMatch = rgbaMatches[rgbaMatches.length - 1].match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
      
      if (startMatch && endMatch) {
        const [, r, g, b] = startMatch;
        const startOpacity = parseFloat(startMatch[4]);
        const endOpacity = parseFloat(endMatch[4]);
        
        const innerRadius = radius * 0.05;
        const outerRadius = radius * 0.95;
        
        const gradientX1 = center + innerRadius * Math.cos(midAngle);
        const gradientY1 = center + innerRadius * Math.sin(midAngle);
        const gradientX2 = center + outerRadius * Math.cos(midAngle);
        const gradientY2 = center + outerRadius * Math.sin(midAngle);
        
        const centerOpacity = Math.min(1.0, startOpacity);
        const edgeOpacity = Math.max(0.4, endOpacity);
        
        return (
          <>
            <defs>
              <linearGradient id={gradientId} x1={`${gradientX1}`} y1={`${gradientY1}`} x2={`${gradientX2}`} y2={`${gradientY2}`}>
                <stop offset="0%" stopColor={`rgba(${r}, ${g}, ${b}, ${centerOpacity})`} />
                <stop offset="30%" stopColor={`rgba(${r}, ${g}, ${b}, ${centerOpacity * 0.85})`} />
                <stop offset="70%" stopColor={`rgba(${r}, ${g}, ${b}, ${edgeOpacity * 1.2})`} />
                <stop offset="100%" stopColor={`rgba(${r}, ${g}, ${b}, ${edgeOpacity})`} />
              </linearGradient>
            </defs>
            <path
              d={pathData}
              fill={`url(#${gradientId})`}
              stroke={isHovered ? "rgba(255, 255, 255, 0.4)" : "rgba(255, 255, 255, 0.15)"}
              strokeWidth={isHovered ? 3 : 2}
              opacity={isHovered ? 1 : 1}
              onMouseEnter={onMouseEnter}
              onMouseLeave={onMouseLeave}
              style={{ 
                cursor: "pointer", 
                transition: "all 0.2s ease",
                transformOrigin: `${center}px ${center}px`,
              }}
            />
          </>
        );
      }
    }
  }
  
  const solidColor = extractColorFromGradient(color);
  const opacity = isHovered ? 1 : 0.85;
  const strokeWidth = isHovered ? 3 : 2;
  const strokeColor = isHovered ? "rgba(255, 255, 255, 0.4)" : "rgba(255, 255, 255, 0.15)";
  
  return (
    <path
      d={pathData}
      fill={solidColor}
      stroke={strokeColor}
      strokeWidth={strokeWidth}
      opacity={opacity}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{ 
        cursor: "pointer", 
        transition: "all 0.2s ease",
        transformOrigin: `${center}px ${center}px`,
      }}
    />
  );
}

export function PieChart({
  data,
  config,
  title,
  enhancement,
  containerStyle,
  onSegmentHover,
  hoveredSegmentKey,
}) {
  const [internalHoveredSegment, setInternalHoveredSegment] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  
  const segments = useMemo(() => {
    if (!data || !Array.isArray(data) || data.length === 0) {
      return [];
    }
    
    const processedData = config.processData ? config.processData(data) : data;
    const maxShare = processedData.reduce(
      (max, item) => Math.max(max, item.share ?? 0),
      0
    );
    
    let currentAngle = -Math.PI / 2;
    const segments = [];
    
    processedData.forEach((item, index) => {
      const share = item.share ?? 0;
      if (share <= 0) return;
      
      const angle = share * 2 * Math.PI;
      const startAngle = currentAngle;
      const endAngle = currentAngle + angle;
      
      const color = config.getSegmentColor
        ? config.getSegmentColor(item, processedData, index)
        : getWarmColorGradient(share, maxShare);
      
      segments.push({
        ...item,
        startAngle,
        endAngle,
        color,
        index,
      });
      
      currentAngle = endAngle;
    });
    
    return segments;
  }, [data, config]);
  
  const hoveredSegment = useMemo(() => {
    if (hoveredSegmentKey !== undefined && hoveredSegmentKey !== null) {
      return segments.find(s => {
        const key = config.getSegmentKey ? config.getSegmentKey(s) : s.index;
        return key === hoveredSegmentKey;
      }) || null;
    }
    return internalHoveredSegment;
  }, [hoveredSegmentKey, internalHoveredSegment, segments, config]);
  
  const handleMouseEnter = (e, segment) => {
    const rect = e.currentTarget.closest("svg").getBoundingClientRect();
    const segmentKey = config.getSegmentKey ? config.getSegmentKey(segment) : segment.index;
    setInternalHoveredSegment(segment);
    if (onSegmentHover) {
      onSegmentHover(segmentKey);
    }
    setTooltipPosition({
      x: rect.left + rect.width / 2,
      y: rect.top - 10,
    });
  };
  
  const handleMouseLeave = () => {
    setInternalHoveredSegment(null);
    if (onSegmentHover) {
      onSegmentHover(null);
    }
    setTooltipPosition({ x: 0, y: 0 });
  };
  
  const defaultContainerStyle = {
    background: "rgba(255, 255, 255, 0.05)",
    borderRadius: "16px",
    padding: "2rem",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    maxWidth: "1200px",
    margin: "0 auto",
  };
  
  if (segments.length === 0) {
    return (
      <div style={{ marginTop: "2rem" }}>
        <PieChartHeader title={title} enhancement={enhancement} />
        <div style={{ ...defaultContainerStyle, ...containerStyle }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "300px",
              opacity: 0.5,
            }}
          >
            No data available
          </div>
        </div>
      </div>
    );
  }
  
  const size = 280;
  
  return (
    <div style={{ marginTop: "2rem" }}>
      <PieChartHeader title={title} enhancement={enhancement} />
      
      <div style={{ ...defaultContainerStyle, ...containerStyle }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "1.5rem",
          }}
        >
          <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            style={{ overflow: "visible" }}
          >
            <g>
              {segments.map((segment) => (
                <PieSlice
                  key={config.getSegmentKey ? config.getSegmentKey(segment) : segment.index}
                  segment={segment}
                  index={segment.index}
                  totalSegments={segments.length}
                  onMouseEnter={(e) => handleMouseEnter(e, segment)}
                  onMouseLeave={handleMouseLeave}
                  isHovered={hoveredSegment && config.getSegmentKey
                    ? config.getSegmentKey(hoveredSegment) === config.getSegmentKey(segment)
                    : hoveredSegment === segment}
                />
              ))}
            </g>
          </svg>
          
          {config.renderLegend && config.renderLegend(segments, hoveredSegmentKey, onSegmentHover)}
        </div>
      </div>
      
      <PieChartTooltip
        segment={hoveredSegment}
        position={tooltipPosition}
        formatLabel={config.formatLabel}
        formatValue={config.formatValue}
      />
    </div>
  );
}
