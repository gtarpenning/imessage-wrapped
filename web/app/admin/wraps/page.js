"use client";

import { useEffect, useState } from "react";
import { PieChart, getWarmColorGradient } from "@/lib/histogram";

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [adminKey, setAdminKey] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const authenticate = async (key) => {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "") || "";
      const response = await fetch(`${baseUrl}/api/admin/wraps`, {
        headers: {
          Authorization: `Bearer ${key}`,
        },
      });

      if (response.ok) {
        const json = await response.json();
        setData(json);
        setIsAuthenticated(true);
        localStorage.setItem("admin_key", key);
      } else {
        setError("Invalid admin key");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const savedKey = localStorage.getItem("admin_key");
    if (savedKey) {
      setAdminKey(savedKey);
      authenticate(savedKey);
    } else {
      setLoading(false);
    }
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    authenticate(adminKey);
  };

  const handleLogout = () => {
    localStorage.removeItem("admin_key");
    setIsAuthenticated(false);
    setData(null);
    setAdminKey("");
  };

  if (loading) {
    return (
      <div className="container" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="loading">Loading admin dashboard...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="container" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ maxWidth: "400px", width: "100%" }}>
          <h1 style={{ marginBottom: "2rem", textAlign: "center" }}>
            Admin <span className="gradient-text">Dashboard</span>
          </h1>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <input
              type="password"
              value={adminKey}
              onChange={(e) => setAdminKey(e.target.value)}
              placeholder="Enter admin key"
              style={{
                padding: "1rem",
                borderRadius: "0.5rem",
                border: "2px solid rgba(255,255,255,0.2)",
                background: "rgba(255,255,255,0.1)",
                color: "white",
                fontSize: "1rem",
              }}
            />
            <button
              type="submit"
              style={{
                padding: "1rem",
                borderRadius: "0.5rem",
                background: "linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)",
                color: "white",
                border: "none",
                fontSize: "1rem",
                fontWeight: "600",
                cursor: "pointer",
              }}
            >
              Login
            </button>
            {error && <p style={{ color: "#ef4444", textAlign: "center" }}>{error}</p>}
          </form>
        </div>
      </div>
    );
  }

  const { wraps, total_wraps, total_views, aggregates } = data || {};

  return (
    <main className="container" style={{ paddingTop: "2rem", paddingBottom: "4rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <h1>
          Admin <span className="gradient-text">Dashboard</span>
        </h1>
        <button
          onClick={handleLogout}
          style={{
            padding: "0.5rem 1rem",
            borderRadius: "0.5rem",
            background: "rgba(255,255,255,0.1)",
            color: "white",
            border: "1px solid rgba(255,255,255,0.2)",
            cursor: "pointer",
          }}
        >
          Logout
        </button>
      </div>

      <Overview totalWraps={total_wraps} totalViews={total_views} />
      <VolumeSection aggregates={aggregates} />
      <TemporalSection aggregates={aggregates} />
      <ContactsSection aggregates={aggregates} />
      <ContentSection aggregates={aggregates} />
      <SentimentSection aggregates={aggregates} />
      <MessageLengthSection aggregates={aggregates} />
      <ConversationsSection aggregates={aggregates} />
      <GhostsSection aggregates={aggregates} />
      <ResponseTimesSection aggregates={aggregates} />
      <TapbacksSection aggregates={aggregates} />
      <StreaksSection aggregates={aggregates} />
      <WrapsTable wraps={wraps} />
    </main>
  );
}

function Overview({ totalWraps, totalViews }) {
  return (
    <Section title="📊 Overview">
      <StatGrid>
        <StatCard title="Total Wraps" value={formatNumber(totalWraps)} />
        <StatCard title="Total Views" value={formatNumber(totalViews)} />
        <StatCard title="Avg Views per Wrap" value={formatDecimal(totalWraps > 0 ? totalViews / totalWraps : 0, 1)} />
      </StatGrid>
    </Section>
  );
}

function VolumeSection({ aggregates }) {
  return (
    <Section title="💬 Volume Statistics">
      <StatGrid>
        <MetricCard title="Total Messages" data={getAggregate(aggregates, 'volume.total_messages')} />
        <MetricCard title="Sent" data={getAggregate(aggregates, 'volume.sent')} />
        <MetricCard title="Received" data={getAggregate(aggregates, 'volume.received')} />
        <MetricCard title="iMessages" data={getAggregate(aggregates, 'volume.total_imessages')} />
        <MetricCard title="SMS" data={getAggregate(aggregates, 'volume.total_sms')} />
        <MetricCard title="Total Words" data={getAggregate(aggregates, 'volume.total_words')} />
        <MetricCard title="Total Characters" data={getAggregate(aggregates, 'volume.total_chars')} />
      </StatGrid>
      {aggregates?.volume?.busiest_days && aggregates.volume.busiest_days.length > 0 && (
        <BusiestDaysSection days={aggregates.volume.busiest_days} />
      )}
    </Section>
  );
}

function BusiestDaysSection({ days }) {
  return (
    <div style={{ marginTop: "2rem" }}>
      <h4 style={{ marginBottom: "1rem", opacity: 0.8 }}>📅 Busiest Days Distribution</h4>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "1rem" }}>
        {days.slice(0, 10).map((day) => (
          <div
            key={day.date}
            style={{
              background: "rgba(255,255,255,0.03)",
              padding: "1rem",
              borderRadius: "0.5rem",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <div style={{ fontSize: "0.85rem", opacity: 0.6 }}>{day.date}</div>
            <div style={{ fontSize: "1.5rem", fontWeight: "600", color: "#ec4899" }}>{formatNumber(day.count)}</div>
            <div style={{ fontSize: "0.75rem", opacity: 0.5 }}>messages</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TemporalSection({ aggregates }) {
  const hourly = aggregates?.temporal?.hourly_distribution || Array(24).fill(0);
  const daily = aggregates?.temporal?.daily_distribution || Array(7).fill(0);
  const monthly = aggregates?.temporal?.monthly_distribution || Array(12).fill(0);

  // Debug logging
  console.log('Temporal Data Debug:', {
    hourly: {
      data: hourly,
      sum: hourly.reduce((a, b) => a + b, 0),
      max: Math.max(...hourly),
      min: Math.min(...hourly),
    },
    daily: {
      data: daily,
      sum: daily.reduce((a, b) => a + b, 0),
      max: Math.max(...daily),
      min: Math.min(...daily),
    },
    monthly: {
      data: monthly,
      sum: monthly.reduce((a, b) => a + b, 0),
      max: Math.max(...monthly),
      min: Math.min(...monthly),
    }
  });

  return (
    <Section title="⏰ Temporal Patterns">
      <div style={{ marginBottom: "2rem" }}>
        <h4 style={{ marginBottom: "0.5rem", opacity: 0.8 }}>Hourly Distribution</h4>
        <p style={{ fontSize: "0.85rem", opacity: 0.6, marginBottom: "1rem" }}>
          Total: {formatNumber(hourly.reduce((a, b) => a + b, 0))} | 
          Max: {formatNumber(Math.max(...hourly))} | 
          Min: {formatNumber(Math.min(...hourly))}
        </p>
        <Histogram 
          data={hourly} 
          labels={Array.from({ length: 24 }, (_, i) => i)} 
          formatLabel={(h) => {
            const period = h >= 12 ? "PM" : "AM";
            const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
            return `${displayHour}${period}`;
          }}
        />
      </div>
      <div style={{ marginBottom: "2rem" }}>
        <h4 style={{ marginBottom: "0.5rem", opacity: 0.8 }}>Daily Distribution</h4>
        <p style={{ fontSize: "0.85rem", opacity: 0.6, marginBottom: "1rem" }}>
          Total: {formatNumber(daily.reduce((a, b) => a + b, 0))} | 
          Max: {formatNumber(Math.max(...daily))} | 
          Min: {formatNumber(Math.min(...daily))}
        </p>
        <Histogram data={daily} labels={["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]} />
      </div>
      <div>
        <h4 style={{ marginBottom: "0.5rem", opacity: 0.8 }}>Monthly Distribution</h4>
        <p style={{ fontSize: "0.85rem", opacity: 0.6, marginBottom: "1rem" }}>
          Total: {formatNumber(monthly.reduce((a, b) => a + b, 0))} | 
          Max: {formatNumber(Math.max(...monthly))} | 
          Min: {formatNumber(Math.min(...monthly))}
        </p>
        <Histogram data={monthly} labels={["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]} />
      </div>
      {aggregates?.temporal?.weekday_weekend && (
        <div style={{ marginTop: "2rem", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
          <StatCard title="Avg Weekday Messages" value={formatNumber(aggregates.temporal.weekday_weekend.avg_weekday)} />
          <StatCard title="Avg Weekend Messages" value={formatNumber(aggregates.temporal.weekday_weekend.avg_weekend)} />
        </div>
      )}
    </Section>
  );
}

function ContactsSection({ aggregates }) {
  return (
    <Section title="👥 Contacts Statistics">
      <StatGrid>
        <MetricCard title="Top Contact Messages" data={getAggregate(aggregates, 'contacts.top_contact_message_counts')} />
        <MetricCard title="Total Contacts" data={getAggregate(aggregates, 'contacts.total_contacts')} />
        <MetricCard title="Unique Contacts Messaged" data={getAggregate(aggregates, 'contacts.unique_contacts_messaged')} />
        <MetricCard title="Unique Contacts Received From" data={getAggregate(aggregates, 'contacts.unique_contacts_received_from')} />
      </StatGrid>
      {aggregates?.contacts?.distribution_buckets && (
        <ContactDistributionChart distribution={aggregates.contacts.distribution_buckets} />
      )}
    </Section>
  );
}

function ContactDistributionChart({ distribution }) {
  const max = Math.max(...distribution.map(d => d.count), 0);
  
  return (
    <div style={{ marginTop: "2rem" }}>
      <h4 style={{ marginBottom: "1rem", opacity: 0.8 }}>Message Distribution Across Contacts</h4>
      <div style={{ background: "rgba(255,255,255,0.05)", padding: "2rem", borderRadius: "1rem", border: "1px solid rgba(255,255,255,0.1)" }}>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-end", height: "200px" }}>
          {distribution.map((bucket, i) => {
            const height = max > 0 ? (bucket.count / max) * 100 : 0;
            return (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div
                  style={{
                    width: "100%",
                    height: `${height}%`,
                    background: getWarmColorGradient(bucket.count, max),
                    borderRadius: "0.25rem 0.25rem 0 0",
                    minHeight: height > 0 ? "2px" : "0",
                  }}
                  title={`${bucket.label}: ${bucket.count} contacts`}
                />
                <span style={{ fontSize: "0.65rem", marginTop: "0.25rem", opacity: 0.6 }}>
                  {bucket.label}
                </span>
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: "1rem", fontSize: "0.85rem", opacity: 0.7, textAlign: "center" }}>
          Number of contacts by message count ranges
        </div>
      </div>
    </div>
  );
}

function ContentSection({ aggregates }) {
  return (
    <Section title="📝 Content Statistics">
      <StatGrid>
        <MetricCard title="Total Emojis" data={getAggregate(aggregates, 'content.total_emojis')} />
        <MetricCard title="Unique Emojis" data={getAggregate(aggregates, 'content.unique_emojis')} />
        <MetricCard title="Word Count" data={getAggregate(aggregates, 'content.word_counts')} />
        <MetricCard title="Question Marks" data={getAggregate(aggregates, 'content.question_marks')} />
        <MetricCard title="Exclamation Marks" data={getAggregate(aggregates, 'content.exclamation_marks')} />
        <MetricCard title="Attachments Sent" data={getAggregate(aggregates, 'content.attachments_sent')} />
        <MetricCard title="Attachments Received" data={getAggregate(aggregates, 'content.attachments_received')} />
        <MetricCard title="Double Texts" data={getAggregate(aggregates, 'content.double_texts')} />
      </StatGrid>
      {aggregates?.content?.top_emojis && aggregates.content.top_emojis.length > 0 && (
        <TopEmojisSection emojis={aggregates.content.top_emojis} />
      )}
    </Section>
  );
}

function TopEmojisSection({ emojis }) {
  return (
    <div style={{ marginTop: "2rem" }}>
      <h4 style={{ marginBottom: "1rem", opacity: 0.8 }}>🎭 Most Popular Emojis Across All Wraps</h4>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: "1rem" }}>
        {emojis.slice(0, 12).map((emoji, idx) => (
          <div
            key={idx}
            style={{
              background: "rgba(255,255,255,0.05)",
              padding: "1.5rem",
              borderRadius: "0.75rem",
              border: "1px solid rgba(255,255,255,0.1)",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>{emoji.emoji}</div>
            <div style={{ fontSize: "1.25rem", fontWeight: "600", color: "#a78bfa" }}>{formatNumber(emoji.count)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SentimentSection({ aggregates }) {
  return (
    <Section title="😊 Sentiment Analysis">
      <StatGrid>
        <MetricCard title="Overall Score" data={getAggregate(aggregates, 'content.sentiment.overall_scores')} isDecimal />
        <MetricCard title="Positive %" data={getAggregate(aggregates, 'content.sentiment.positive_percentages')} isPercentage />
        <MetricCard title="Negative %" data={getAggregate(aggregates, 'content.sentiment.negative_percentages')} isPercentage />
        <MetricCard title="Neutral %" data={getAggregate(aggregates, 'content.sentiment.neutral_percentages')} isPercentage />
      </StatGrid>
    </Section>
  );
}

function MessageLengthSection({ aggregates }) {
  return (
    <Section title="📏 Message Length Statistics">
      <StatGrid>
        <MetricCard title="Avg Length (chars)" data={getAggregate(aggregates, 'content.message_lengths.avg_length')} isDecimal />
      </StatGrid>
      {aggregates?.content?.word_count_distribution && (
        <WordCountDistribution distribution={aggregates.content.word_count_distribution} />
      )}
    </Section>
  );
}

function WordCountDistribution({ distribution }) {
  return (
    <div style={{ marginTop: "2rem" }}>
      <h4 style={{ marginBottom: "1rem", opacity: 0.8 }}>Word Count Distribution</h4>
      <div style={{ background: "rgba(255,255,255,0.05)", padding: "2rem", borderRadius: "1rem", border: "1px solid rgba(255,255,255,0.1)" }}>
        <Histogram 
          data={distribution.buckets} 
          labels={distribution.labels}
          formatLabel={(label) => `${label} words`}
        />
      </div>
    </div>
  );
}

function ConversationsSection({ aggregates }) {
  return (
    <Section title="💬 Conversation Statistics">
      <StatGrid>
        <MetricCard title="Total Conversations" data={getAggregate(aggregates, 'conversations.total_conversations')} />
        <MetricCard title="Longest Conversation" data={getAggregate(aggregates, 'conversations.longest_conversation_lengths')} />
        <MetricCard title="Avg Messages/Conv" data={getAggregate(aggregates, 'conversations.avg_messages_per_conversation')} isDecimal />
      </StatGrid>
    </Section>
  );
}

function GhostsSection({ aggregates }) {
  return (
    <Section title="👻 Ghost Statistics">
      <StatGrid>
        <MetricCard title="People You Ghosted" data={getAggregate(aggregates, 'ghosts.ghost_counts')} />
        <MetricCard title="People Who Ghosted You" data={getAggregate(aggregates, 'ghosts.ghosted_counts')} />
      </StatGrid>
    </Section>
  );
}

function ResponseTimesSection({ aggregates }) {
  return (
    <Section title="⚡ Response Time Statistics">
      <StatGrid>
        <MetricCard 
          title="Avg Response Time" 
          data={getAggregate(aggregates, 'response_times.avg_response_seconds')} 
          formatter={formatDuration}
        />
        <MetricCard 
          title="Median Response Time" 
          data={getAggregate(aggregates, 'response_times.median_response_seconds')}
          formatter={formatDuration}
        />
      </StatGrid>
    </Section>
  );
}

function TapbacksSection({ aggregates }) {
  return (
    <Section title="❤️ Tapback Statistics">
      <StatGrid>
        <MetricCard title="Total Tapbacks" data={getAggregate(aggregates, 'tapbacks.total_tapbacks')} />
        <MetricCard title="Given" data={getAggregate(aggregates, 'tapbacks.given')} />
        <MetricCard title="Received" data={getAggregate(aggregates, 'tapbacks.received')} />
      </StatGrid>
      {aggregates?.tapbacks?.distribution && (
        <TapbackDistribution distribution={aggregates.tapbacks.distribution} />
      )}
    </Section>
  );
}

const TAPBACK_EMOJIS = {
  love: "❤️",
  like: "👍",
  laugh: "😂",
  emphasize: "❗",
  dislike: "👎",
  question: "❓",
};

const TAPBACK_LABELS = {
  love: "Love",
  like: "Like",
  laugh: "Laugh",
  emphasize: "Emphasize",
  dislike: "Dislike",
  question: "Question",
};

function TapbackDistribution({ distribution }) {
  const tapbackTypes = Object.keys(distribution).sort((a, b) => distribution[b] - distribution[a]);
  
  return (
    <div style={{ marginTop: "2rem" }}>
      <h4 style={{ marginBottom: "1rem", opacity: 0.8 }}>Tapback Distribution</h4>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "1rem" }}>
        {tapbackTypes.map((type) => (
          <div
            key={type}
            style={{
              background: "rgba(255,255,255,0.05)",
              padding: "1.5rem",
              borderRadius: "0.75rem",
              border: "1px solid rgba(255,255,255,0.1)",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>{TAPBACK_EMOJIS[type] || type}</div>
            <div style={{ fontSize: "0.85rem", opacity: 0.7, marginBottom: "0.25rem" }}>{TAPBACK_LABELS[type] || type}</div>
            <div style={{ fontSize: "1.5rem", fontWeight: "600", color: "#a78bfa" }}>{formatNumber(distribution[type])}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StreaksSection({ aggregates }) {
  return (
    <Section title="🔥 Streak Statistics">
      <StatGrid>
        <MetricCard title="Longest Streak (days)" data={getAggregate(aggregates, 'streaks.longest_streak_days')} />
      </StatGrid>
    </Section>
  );
}

function WrapsTable({ wraps = [] }) {
  const [sortBy, setSortBy] = useState("created_at");
  const [sortDesc, setSortDesc] = useState(true);

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortDesc(!sortDesc);
    } else {
      setSortBy(field);
      setSortDesc(true);
    }
  };

  const sortedWraps = [...wraps].sort((a, b) => {
    let aVal = a[sortBy];
    let bVal = b[sortBy];
    
    // Handle date comparison
    if (sortBy === "created_at") {
      aVal = new Date(aVal).getTime();
      bVal = new Date(bVal).getTime();
    }
    
    if (sortDesc) {
      return bVal - aVal;
    } else {
      return aVal - bVal;
    }
  });

  const displayWraps = sortedWraps.slice(0, 10);

  const SortableHeader = ({ field, children }) => (
    <th
      onClick={() => handleSort(field)}
      style={{
        padding: "1rem",
        textAlign: "left",
        cursor: "pointer",
        userSelect: "none",
        position: "relative",
      }}
    >
      {children}
      {sortBy === field && (
        <span style={{ marginLeft: "0.5rem", opacity: 0.6 }}>
          {sortDesc ? "↓" : "↑"}
        </span>
      )}
    </th>
  );

  return (
    <Section title="🎁 Recent Wraps (Top 10)">
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid rgba(255,255,255,0.2)" }}>
              <th style={{ padding: "1rem", textAlign: "left" }}>ID</th>
              <th style={{ padding: "1rem", textAlign: "left" }}>Year</th>
              <SortableHeader field="created_at">Created</SortableHeader>
              <SortableHeader field="views">Views</SortableHeader>
              <SortableHeader field="total_messages">Total Msgs</SortableHeader>
              <SortableHeader field="total_sent">Sent</SortableHeader>
              <SortableHeader field="total_received">Received</SortableHeader>
              <th style={{ padding: "1rem", textAlign: "left" }}>Link</th>
            </tr>
          </thead>
          <tbody>
            {displayWraps.map((wrap) => (
              <tr key={wrap.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                <td style={{ padding: "1rem", fontFamily: "monospace", fontSize: "0.85rem" }}>{wrap.id}</td>
                <td style={{ padding: "1rem" }}>{wrap.year}</td>
                <td style={{ padding: "1rem", fontSize: "0.9rem" }}>
                  {new Date(wrap.created_at).toLocaleDateString()}
                </td>
                <td style={{ padding: "1rem" }}>{formatNumber(wrap.views)}</td>
                <td style={{ padding: "1rem" }}>{formatNumber(wrap.total_messages)}</td>
                <td style={{ padding: "1rem", color: "#8b5cf6" }}>{formatNumber(wrap.total_sent)}</td>
                <td style={{ padding: "1rem", color: "#ec4899" }}>{formatNumber(wrap.total_received)}</td>
                <td style={{ padding: "1rem" }}>
                  <a
                    href={`/${wrap.year}/${wrap.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "#8b5cf6", textDecoration: "none" }}
                  >
                    View →
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: "1rem", fontSize: "0.85rem", opacity: 0.6, textAlign: "center" }}>
        Showing {displayWraps.length} of {wraps.length} total wraps. Click column headers to sort.
      </div>
    </Section>
  );
}

// Helper Components
function Section({ title, children }) {
  return (
    <div style={{ marginBottom: "3rem" }}>
      <h2 style={{ marginBottom: "1.5rem" }}>{title}</h2>
      {children}
    </div>
  );
}

function StatGrid({ children }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
      {children}
    </div>
  );
}

function StatCard({ title, value, subtitle }) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.05)",
        padding: "1.5rem",
        borderRadius: "1rem",
        border: "1px solid rgba(255,255,255,0.1)",
      }}
    >
      <p style={{ opacity: 0.6, marginBottom: "0.5rem", fontSize: "0.9rem" }}>{title}</p>
      <p style={{ fontSize: "2rem", fontWeight: "700" }}>{value}</p>
      {subtitle && <p style={{ opacity: 0.5, marginTop: "0.5rem", fontSize: "0.85rem" }}>{subtitle}</p>}
    </div>
  );
}

function MetricCard({ title, data, isDecimal = false, isPercentage = false, formatter = null }) {
  const safeData = data || { min: 0, max: 0, avg: 0, median: 0, total: 0 };
  
  const formatValue = (val) => {
    if (val === undefined || val === null || isNaN(val)) return "0";
    if (formatter) return formatter(val);
    if (isDecimal) return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (isPercentage) return val.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%";
    return val.toLocaleString(undefined, { maximumFractionDigits: 0 });
  };

  return (
    <div
      style={{
        background: "rgba(255,255,255,0.05)",
        padding: "1rem",
        borderRadius: "0.75rem",
        border: "1px solid rgba(255,255,255,0.1)",
      }}
    >
      <p style={{ opacity: 0.6, marginBottom: "0.75rem", fontSize: "0.85rem" }}>{title}</p>
      <div style={{ fontSize: "0.75rem", opacity: 0.8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
          <span>Total:</span>
          <span style={{ fontWeight: "600" }}>{formatValue(safeData.total)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
          <span>Avg:</span>
          <span style={{ fontWeight: "600" }}>{formatValue(safeData.avg)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
          <span>Median:</span>
          <span style={{ fontWeight: "600" }}>{formatValue(safeData.median)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
          <span>Min:</span>
          <span>{formatValue(safeData.min)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Max:</span>
          <span>{formatValue(safeData.max)}</span>
        </div>
      </div>
    </div>
  );
}

function Histogram({ data, labels, formatLabel }) {
  const safeData = data || [];
  const max = Math.max(...safeData, 0);
  const sum = safeData.reduce((a, b) => a + b, 0);
  
  // Debug logging
  console.log('Histogram rendering:', {
    dataLength: safeData.length,
    max,
    sum,
    sampleValues: safeData.slice(0, 5),
    allZero: safeData.every(v => v === 0),
    allSame: safeData.every(v => v === safeData[0]),
  });
  
  // If all data is zero, show a message
  if (sum === 0) {
    return (
      <div style={{ background: "rgba(255,255,255,0.05)", padding: "2rem", borderRadius: "1rem", border: "1px solid rgba(255,255,255,0.1)", textAlign: "center", opacity: 0.5 }}>
        No data available
      </div>
    );
  }
  
  return (
    <div style={{ background: "rgba(255,255,255,0.05)", padding: "2rem", borderRadius: "1rem", border: "1px solid rgba(255,255,255,0.1)" }}>
      <div style={{ display: "flex", gap: "0.25rem", alignItems: "flex-end", height: "200px", marginBottom: "1rem" }}>
        {safeData.map((value, i) => {
          const height = max > 0 ? ((value || 0) / max) * 100 : 0;
          return (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div
                style={{
                  width: "100%",
                  height: `${height}%`,
                  background: getWarmColorGradient(value || 0, max),
                  borderRadius: "0.25rem 0.25rem 0 0",
                  minHeight: height > 0 ? "2px" : "0",
                  transition: "height 0.3s",
                }}
                title={`${labels?.[i] || i}: ${(value || 0).toLocaleString()}`}
              />
            </div>
          );
        })}
      </div>
      {labels && (
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", opacity: 0.6 }}>
          {labels.map((label, i) => {
            // Show every nth label to avoid crowding
            const showEvery = labels.length > 12 ? Math.ceil(labels.length / 12) : 1;
            if (i % showEvery !== 0 && i !== labels.length - 1) return <span key={i} />;
            
            const displayLabel = formatLabel ? formatLabel(label) : label;
            return <span key={i}>{displayLabel}</span>;
          })}
        </div>
      )}
    </div>
  );
}

// Utility Functions
function formatNumber(num) {
  if (num === undefined || num === null || isNaN(num)) return "0";
  return num.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function formatDecimal(num, decimals = 2) {
  if (num === undefined || num === null || isNaN(num)) return "0";
  return num.toLocaleString(undefined, { 
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals 
  });
}

function formatDuration(seconds) {
  if (!seconds || isNaN(seconds)) return "0s";
  if (seconds < 60) return `${formatDecimal(seconds, 0)}s`;
  if (seconds < 3600) return `${formatDecimal(seconds / 60, 1)}m`;
  if (seconds < 86400) return `${formatDecimal(seconds / 3600, 1)}h`;
  return `${formatDecimal(seconds / 86400, 1)}d`;
}

function getAggregate(aggregates, path) {
  const parts = path.split('.');
  let value = aggregates;
  for (const part of parts) {
    value = value?.[part];
    if (value === undefined || value === null) {
      return { min: 0, max: 0, avg: 0, median: 0, total: 0 };
    }
  }
  return value;
}
