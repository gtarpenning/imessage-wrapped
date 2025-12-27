import { Fragment } from "react";

function PhraseTable({ title, rows, columns }) {
  if (!rows || rows.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        padding: "1.5rem",
        borderRadius: "1.25rem",
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 25px 40px -30px rgba(0,0,0,0.65)",
      }}
    >
      <h4 style={{ marginTop: 0, marginBottom: "1rem", fontSize: "1.1rem" }}>
        {title}
      </h4>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))`,
          gap: "0.65rem",
          fontSize: "0.9rem",
        }}
      >
        {columns.map((col) => (
          <span key={col} style={{ opacity: 0.5, fontSize: "0.85rem" }}>
            {col}
          </span>
        ))}
        {rows.map((row, idx) => (
          <Fragment key={idx}>
            {columns.map((col) => (
              <span
                key={col}
                style={{
                  fontVariantNumeric: "tabular-nums",
                  fontWeight: col === "Phrase" ? 600 : 400,
                }}
              >
                {row[col] ?? row[col.toLowerCase()] ?? "—"}
              </span>
            ))}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

export default function PhraseHighlights({ overall, signature }) {
  const topPhrases = overall?.slice(0, 5).map((item, idx) => ({
    Rank: `${idx + 1}.`,
    Phrase: item.phrase || item.text || "—",
    Count: item.occurrences?.toLocaleString?.() ?? item.occurrences,
  }));

  const signatureRows = signature?.slice(0, 5).map((entry) => ({
    Contact: entry.contact_name || entry.contact_id || "Unknown",
    Phrase: entry.phrase || entry.text || "",
    Count: entry.occurrences?.toLocaleString?.() ?? entry.occurrences,
  }));

  if (
    (!topPhrases || topPhrases.length === 0) &&
    (!signatureRows || signatureRows.length === 0)
  ) {
    return null;
  }

  return (
    <div style={{ marginTop: "2rem" }}>
      <h3 style={{ fontSize: "1.4rem", marginBottom: "1rem" }}>
        📝 Signature Phrases
      </h3>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: "1.5rem",
        }}
      >
        <PhraseTable
          title="Most Used Phrases"
          rows={topPhrases}
          columns={["Rank", "Phrase", "Count"]}
        />
        <PhraseTable
          title="Signature Lines by Contact"
          rows={signatureRows}
          columns={["Contact", "Phrase", "Count"]}
        />
      </div>
    </div>
  );
}
