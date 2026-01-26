import { useMemo, useState } from "react";
import EnhancedText from "./EnhancedText";
import { useEnhancement, PLAYFUL_INSTRUCTION } from "@/hooks/useEnhancement";

const RADIAL_SIZE = 360;
const RADIAL_CENTER = RADIAL_SIZE / 2;
const RADIAL_BASE_RADIUS = 40;
const RADIAL_MAX_RADIUS = RADIAL_CENTER - 30;
const HOUR_LABELS = [
  "12a",
  "1a",
  "2a",
  "3a",
  "4a",
  "5a",
  "6a",
  "7a",
  "8a",
  "9a",
  "10a",
  "11a",
  "12p",
  "1p",
  "2p",
  "3p",
  "4p",
  "5p",
  "6p",
  "7p",
  "8p",
  "9p",
  "10p",
  "11p",
];

function formatHourLabel(hour) {
  if (hour === null || hour === undefined || hour < 0) return "—";
  const period = hour >= 12 ? "PM" : "AM";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display} ${period}`;
}

function shortDate(value) {
  if (!value) return "—";
  const raw = String(value);
  if (raw.includes("T")) return raw.split("T")[0];
  if (raw.includes(" ")) return raw.split(" ")[0];
  return raw;
}

export default function TopConversationSection({ deepDive }) {
  const hasDeepDive = Boolean(deepDive);
  const prompt = hasDeepDive
    ? `My top conversation (${deepDive.message_count} messages) is ${
        deepDive.is_group ? "a group chat" : "a one-on-one"
      }. ${PLAYFUL_INSTRUCTION}`
    : null;
  const { enhancement } = useEnhancement(prompt, hasDeepDive);

  if (!hasDeepDive) return null;

  const subtitle = deepDive.name ? `Thread: ${deepDive.name}` : "Thread: your #1 conversation";

  return (
    <div className="section">
      <h2 className="section-title">💬 Deep Dive: #1 Conversation</h2>
      <p className="section-subtitle">{subtitle}</p>
      {enhancement && (
        <EnhancedText style={{ marginTop: "0.5rem" }}>{enhancement}</EnhancedText>
      )}

      <ConversationSummary deepDive={deepDive} />
      <UniquePhrasesBreakdown uniquePhrases={deepDive.unique_phrases} />
      <div className="top-convo-grid">
        <RadialHourChart hourly={deepDive.hourly_distribution} />
        <SessionStartsEndsCard starters={deepDive.starter_analysis} enders={deepDive.ender_analysis} />
      </div>
      <DailyTrendChart activity={deepDive.daily_activity} />
    </div>
  );
}

function InlineHelp({ children, label }) {
  if (!label) return children;
  return (
    <span className="inline-help" tabIndex={0}>
      <span className="inline-help__trigger">{children}</span>
      <span className="inline-help__tooltip" role="tooltip">
        {label}
      </span>
    </span>
  );
}

function HoverHelp({ children, label }) {
  if (!label) return children;
  return (
    <div className="hover-help" tabIndex={0}>
      <div className="hover-help__trigger">{children}</div>
      <div className="hover-help__tooltip" role="tooltip">
        {label}
      </div>
    </div>
  );
}

function ConversationSummary({ deepDive }) {
  const typeLabel = deepDive.is_group ? "Group chat" : "1-on-1 chat";
  const totalDays = deepDive.daily_activity?.total_days || 0;
  const busiestDay = deepDive.daily_activity?.busiest_day;

  return (
    <div className="top-convo-summary">
      <div>
        <p className="top-convo-summary__label">Conversation Type</p>
        <p className="top-convo-summary__value">{typeLabel}</p>
        <p className="top-convo-summary__meta">
          {deepDive.participant_count} participant{deepDive.participant_count === 1 ? "" : "s"}
        </p>
      </div>
      <div>
        <p className="top-convo-summary__label">Messages Counted</p>
        <p className="top-convo-summary__value">
          {deepDive.message_count.toLocaleString()}
        </p>
        <p className="top-convo-summary__meta">
          {shortDate(deepDive.date_range?.start)} – {shortDate(deepDive.date_range?.end)}
        </p>
      </div>
      <div>
        <p className="top-convo-summary__label">Days Active</p>
        <p className="top-convo-summary__value">{totalDays.toLocaleString()}</p>
        <p className="top-convo-summary__meta">
          {busiestDay
            ? `Busiest: ${busiestDay.date} (${busiestDay.total.toLocaleString()} msgs)`
            : "Evenly spread"}
        </p>
      </div>
    </div>
  );
}

function UniquePhrasesBreakdown({ uniquePhrases }) {
  if (!uniquePhrases) return null;

  const you = Array.isArray(uniquePhrases.you) ? uniquePhrases.you : [];
  const them = Array.isArray(uniquePhrases.them) ? uniquePhrases.them : [];

  return (
    <div style={{ marginTop: "2rem" }}>
      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
        <h3 style={{ marginBottom: 0 }}>Signature Phrases</h3>
        <InlineHelp label="Multi-word phrases that show up more for each side within this thread.">
          <span style={{ opacity: 0.7, textDecoration: "underline dotted", cursor: "help" }}>
            What’s this?
          </span>
        </InlineHelp>
      </div>
      <div className="word-usage-grid">
        <UniquePhraseColumn label="You" color="#a855f7" items={you} />
        <UniquePhraseColumn label="Them" color="#ec4899" items={them} />
      </div>
    </div>
  );
}

function UniquePhraseColumn({ label, color, items }) {
  const maxScore =
    items && items.length > 0 ? Math.max(...items.map((item) => Number(item.score) || 0), 0) : 0;
  const safeMax = maxScore > 0 ? maxScore : 1;

  return (
    <div className="word-usage-column">
      <div className="word-usage-column__header">
        <h3>{label}</h3>
        <span>{items?.length || 0} picks</span>
      </div>
      {items && items.length > 0 ? (
        <ul>
          {items.map((item) => (
            <li key={`${label}-${item.phrase}`} className="word-usage-row">
              <div className="word-usage-row__word">
                <span
                  title={`Score: ${Number(item.score || 0).toFixed(4)} · ${item.count} vs ${item.other_count}`}
                >
                  {item.phrase}
                </span>
                <span className="word-usage-row__count">
                  {item.count.toLocaleString()} vs {item.other_count.toLocaleString()}
                </span>
              </div>
              <div className="word-usage-row__bar">
                <span
                  style={{
                    width: `${Math.min(100, Math.max(2, ((Number(item.score) || 0) / safeMax) * 100))}%`,
                    background: color,
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="word-usage-empty">No distinctive phrases detected.</p>
      )}
    </div>
  );
}

function RadialHourChart({ hourly }) {
  const { sentPoints, receivedPoints, sentPath, receivedPath, busiestYou, busiestThem, maxValue } =
    useMemo(() => {
      const hours = Array.from({ length: 24 }, (_, hour) => hour);
      const sent = hourly?.sent || Array(24).fill(0);
      const received = hourly?.received || Array(24).fill(0);
      const maxFromPayload = hourly?.max_value;
      const computedMax = Math.max(
        ...(sent.concat(received).map((value) => Number(value) || 0)),
        0,
      );
      const scaleMax = Math.max(maxFromPayload || 0, computedMax, 1);
      const buildPoints = (values) =>
        hours.map((hour) => {
          const angle = (hour / 24) * Math.PI * 2 - Math.PI / 2;
          const magnitude = Number(values[hour]) || 0;
          const ratio = scaleMax ? magnitude / scaleMax : 0;
          const radius = RADIAL_BASE_RADIUS + ratio * (RADIAL_MAX_RADIUS - RADIAL_BASE_RADIUS);
          const x = RADIAL_CENTER + Math.cos(angle) * radius;
          const y = RADIAL_CENTER + Math.sin(angle) * radius;
          return { hour, x, y, value: magnitude };
        });
      const formatPath = (points) =>
        points
          .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(2)},${point.y.toFixed(2)}`)
          .join(" ") + " Z";
      return {
        sentPoints: buildPoints(sent),
        receivedPoints: buildPoints(received),
        sentPath: formatPath(buildPoints(sent)),
        receivedPath: formatPath(buildPoints(received)),
        busiestYou: hourly?.busiest_hour_you ?? null,
        busiestThem: hourly?.busiest_hour_them ?? null,
        maxValue: scaleMax,
      };
    }, [hourly]);

  if (!hourly || maxValue === 0) return null;

  return (
    <div className="radial-hour-card">
      <h3>Messages by Hour</h3>
      <svg
        viewBox={`0 0 ${RADIAL_SIZE} ${RADIAL_SIZE}`}
        width="100%"
        height={RADIAL_SIZE}
        role="img"
        aria-label="Hourly distribution"
      >
        {[0.25, 0.5, 0.75, 1].map((level) => (
          <circle
            key={level}
            cx={RADIAL_CENTER}
            cy={RADIAL_CENTER}
            r={RADIAL_BASE_RADIUS + level * (RADIAL_MAX_RADIUS - RADIAL_BASE_RADIUS)}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeDasharray="4 6"
          />
        ))}
        <path d={receivedPath} fill="rgba(236, 72, 153, 0.18)" stroke="rgba(236,72,153,0.8)" strokeWidth="2" />
        <path d={sentPath} fill="rgba(168, 85, 247, 0.18)" stroke="rgba(168,85,247,0.9)" strokeWidth="2" />
        {receivedPoints.map((point) => (
          <circle
            key={`recv-${point.hour}`}
            cx={point.x}
            cy={point.y}
            r={3}
            fill="#ec4899"
            opacity={0.8}
            aria-label={`Hour ${HOUR_LABELS[point.hour]} them`}
          />
        ))}
        {sentPoints.map((point) => (
          <circle
            key={`sent-${point.hour}`}
            cx={point.x}
            cy={point.y}
            r={3}
            fill="#a855f7"
            opacity={0.9}
            aria-label={`Hour ${HOUR_LABELS[point.hour]} you`}
          />
        ))}
        {HOUR_LABELS.map((label, index) => {
          const angle = (index / 24) * Math.PI * 2 - Math.PI / 2;
          const radius = RADIAL_MAX_RADIUS + 14;
          const x = RADIAL_CENTER + Math.cos(angle) * radius;
          const y = RADIAL_CENTER + Math.sin(angle) * radius + 4;
          return (
            <text
              key={label}
              x={x}
              y={y}
              textAnchor="middle"
              fontSize="10"
              fill="rgba(255,255,255,0.45)"
            >
              {label}
            </text>
          );
        })}
      </svg>
      <div className="radial-hour-legend">
        <span>
          <span className="legend-dot legend-dot--you" />
          You peak: {formatHourLabel(busiestYou)}
        </span>
        <span>
          <span className="legend-dot legend-dot--them" />
          They peak: {formatHourLabel(busiestThem)}
        </span>
      </div>
    </div>
  );
}

function DailyTrendChart({ activity }) {
  const [hover, setHover] = useState(null);
  const series = useMemo(() => activity?.series || [], [activity]);

  const width = 900;
  const height = 240;
  const padding = 32;

  const { sentPath, receivedPath, ticks } = useMemo(() => {
    const maxVal = Math.max(
      ...series.map((entry) => Math.max(entry.sent, entry.received)),
      1,
    );
    const buildPath = (key) =>
      series
        .map((entry, index) => {
          const x =
            padding +
            (index / Math.max(series.length - 1, 1)) *
              (width - padding * 2);
          const y =
            height -
            padding -
            (entry[key] / maxVal) * (height - padding * 2);
          return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
        })
        .join(" ");
    const tickCount = Math.min(6, series.length);
    const step = Math.max(1, Math.floor(series.length / Math.max(tickCount, 1)));
    const tickEntries = series.filter((_, idx) => idx % step === 0);
    return {
      sentPath: buildPath("sent"),
      receivedPath: buildPath("received"),
      ticks: tickEntries,
    };
  }, [series]);

  if (!series.length) return null;

  const busiest = activity?.busiest_day;
  const slotWidth = (width - padding * 2) / Math.max(series.length, 1);

  return (
    <div className="daily-trend-card">
      <div className="daily-trend-card__header">
        <div>
          <h3>Daily Messages Across the Year</h3>
          <p>
            Shows relative sent (purple) vs received (pink) volume. Peak total:{" "}
            {busiest
              ? `${busiest.date} (${busiest.total.toLocaleString()} total)`
              : "no spikes"}
            .
          </p>
        </div>
        <div className="daily-trend-card__legend">
          <span>
            <span className="legend-dot legend-dot--you" />
            You
          </span>
          <span>
            <span className="legend-dot legend-dot--them" />
            Them
          </span>
        </div>
      </div>
      <div style={{ position: "relative" }}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          width="100%"
          role="img"
          onMouseLeave={() => setHover(null)}
        >
          <rect
            x={padding}
            y={padding}
            width={width - padding * 2}
            height={height - padding * 2}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
          />
          <path d={receivedPath} fill="none" stroke="#ec4899" strokeWidth="2" strokeLinejoin="round" />
          <path d={sentPath} fill="none" stroke="#a855f7" strokeWidth="2" strokeLinejoin="round" />
          {hover && (
            <line
              x1={hover.x}
              y1={padding}
              x2={hover.x}
              y2={height - padding}
              stroke="rgba(255,255,255,0.35)"
              strokeDasharray="4 6"
            />
          )}
          {ticks.map((entry, index) => {
            const x =
              padding +
              (series.indexOf(entry) / Math.max(series.length - 1, 1)) *
                (width - padding * 2);
            return (
              <g key={entry.date || index}>
                <line
                  x1={x}
                  y1={height - padding}
                  x2={x}
                  y2={height - padding + 8}
                  stroke="rgba(255,255,255,0.2)"
                />
                <text
                  x={x}
                  y={height - padding + 22}
                  textAnchor="middle"
                  fontSize="10"
                  fill="rgba(255,255,255,0.6)"
                >
                  {(entry.date || "").slice(5)}
                </text>
              </g>
            );
          })}
          {series.map((entry, idx) => {
            const x =
              padding +
              (idx / Math.max(series.length - 1, 1)) * (width - padding * 2);
            return (
              <rect
                key={`hover-${entry.date || idx}`}
                x={x - slotWidth / 2}
                y={padding}
                width={Math.max(slotWidth, 4)}
                height={height - padding * 2}
                fill="transparent"
                onMouseEnter={() =>
                  setHover({
                    x,
                    date: entry.date,
                    sent: entry.sent,
                    received: entry.received,
                    total: entry.total,
                  })
                }
              />
            );
          })}
        </svg>
        {hover && (
          <div
            style={{
              position: "absolute",
              left: Math.min(Math.max(hover.x - 70, 0), width - 160),
              top: 8,
              background: "rgba(0,0,0,0.85)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: "10px",
              padding: "0.6rem 0.8rem",
              boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
              pointerEvents: "none",
              zIndex: 2,
            }}
          >
            <div style={{ fontSize: "0.8rem", opacity: 0.7 }}>{hover.date}</div>
            <div style={{ fontWeight: 600, marginTop: "0.15rem" }}>
              Total: {hover.total?.toLocaleString() ?? 0}
            </div>
            <div style={{ fontSize: "0.9rem", marginTop: "0.15rem" }}>
              You: {hover.sent?.toLocaleString() ?? 0} · Them:{" "}
              {hover.received?.toLocaleString() ?? 0}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SessionStartsEndsCard({ starters, enders }) {
  const hasStarters = Boolean(starters && starters.total_sessions);
  const hasEnders = Boolean(enders && enders.total_sessions);
  const hasStats = hasStarters || hasEnders;

  if (!hasStats) {
    return (
      <div className="starter-card">
        <h3>Session Starts & Ends</h3>
        <p style={{ opacity: 0.7 }}>Not enough conversation breaks to score this.</p>
      </div>
    );
  }

  const ruleHours = Number(
    starters?.silence_threshold_hours ?? enders?.silence_threshold_hours ?? 0,
  );
  const maxGap = Number(starters?.max_gap_hours || 0);
  const maxGapLabel = maxGap >= 24 ? `${(maxGap / 24).toFixed(1)} days` : `${maxGap.toFixed(1)} hours`;
  const maxGapWindow = starters?.max_gap_window;

  const description = `After a ${ruleHours}h quiet gap (or a new day), whoever sends the first message starts the session, and whoever sends the last message before the next gap ends it.`;

  return (
    <div className="starter-card">
      <h3>Session Starts & Ends</h3>
      <p style={{ marginTop: "0.5rem", opacity: 0.7, fontSize: "0.95rem" }}>{description}</p>

      <div className="session-bars">
        <SessionBarRow
          label="Starts"
          youCount={starters?.you_started || 0}
          themCount={starters?.they_started || 0}
          youRate={Math.round((starters?.you_start_rate || 0) * 100)}
        />
        <SessionBarRow
          label="Ends"
          youCount={enders?.you_ended || 0}
          themCount={enders?.they_ended || 0}
          youRate={Math.round((enders?.you_end_rate || 0) * 100)}
        />
      </div>

      {maxGap > 0 && (
        <p style={{ marginTop: "0.75rem", opacity: 0.65, fontSize: "0.9rem" }}>
          Biggest gap:{" "}
          <InlineHelp
            label={
              maxGapWindow
                ? `From ${maxGapWindow.ended_at} → ${maxGapWindow.next_started_at}`
                : "Longest gap between sessions."
            }
          >
            <span style={{ textDecoration: "underline dotted", cursor: "help" }}>{maxGapLabel}</span>
          </InlineHelp>
        </p>
      )}
    </div>
  );
}

function SessionBarRow({ label, youCount, themCount, youRate }) {
  const safeYouRate = Math.min(100, Math.max(0, Number.isFinite(youRate) ? youRate : 0));
  const safeThemRate = 100 - safeYouRate;
  const tooltip = `You: ${Number(youCount || 0).toLocaleString()} (${safeYouRate}%) · Them: ${Number(
    themCount || 0,
  ).toLocaleString()} (${safeThemRate}%)`;

  return (
    <div className="session-bars__row">
      <div className="session-bars__header">
        <div className="session-bars__label">{label}</div>
        <div className="session-bars__numbers">
          You {Number(youCount || 0).toLocaleString()} · Them {Number(themCount || 0).toLocaleString()}
        </div>
      </div>
      <HoverHelp label={tooltip}>
        <div className="starter-card__meter session-bars__meter" aria-label={tooltip} role="img">
          <div
            className="session-bars__segment session-bars__segment--you"
            style={{ width: `${safeYouRate}%` }}
          />
          <div
            className="session-bars__segment session-bars__segment--them"
            style={{ width: `${safeThemRate}%` }}
          />
        </div>
      </HoverHelp>
    </div>
  );
}
