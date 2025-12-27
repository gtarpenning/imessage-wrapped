export default function ContactDistributionChart({ distribution }) {
  if (!distribution || distribution.length === 0) return null;

  const topChats = distribution.slice(0, 20);

  return (
    <div
      style={{
        marginTop: "2.5rem",
        padding: "1.5rem",
        borderRadius: "1.5rem",
        background: "linear-gradient(145deg, #1f2937, #111827)",
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.45)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: "1rem",
        }}
      >
        <h3 style={{ fontSize: "1.4rem", margin: 0 }}>Chat Concentration</h3>
        <p style={{ margin: 0, opacity: 0.6, fontSize: "0.95rem" }}>
          Top {topChats.length} chats (share of your messages)
        </p>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
        {topChats.map((entry) => {
          const share = Math.min(1, Math.max(0, entry.share || 0));
          return (
            <div
              key={entry.rank}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
              }}
            >
              <div
                style={{
                  width: "3rem",
                  textAlign: "right",
                  opacity: 0.6,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                #{String(entry.rank).padStart(2, "0")}
              </div>
              <div
                style={{
                  flex: 1,
                  height: "0.85rem",
                  borderRadius: "999px",
                  background: "rgba(255,255,255,0.08)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${share * 100}%`,
                    height: "100%",
                    background:
                      "linear-gradient(90deg, #8b5cf6, #ec4899, #f97316)",
                    transition: "width 0.6s ease",
                  }}
                />
              </div>
              <div
                style={{
                  width: "3rem",
                  textAlign: "left",
                  opacity: 0.6,
                  fontSize: "0.9rem",
                }}
              >
                {Math.round(share * 100)}%
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
