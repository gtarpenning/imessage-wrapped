import { Fragment } from "react";

function PhraseTable({ title, rows, columns }) {
  if (!rows || rows.length === 0) {
    return null;
  }

  const columnTemplate = columns
    .map((_, idx) => (idx === 0 ? "minmax(200px, 2fr)" : "minmax(0, 1fr)"))
    .join(" ");

  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        padding: "2rem",
        borderRadius: "1.5rem",
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 40px 55px -40px rgba(0,0,0,0.85)",
      }}
    >
      <h4
        style={{
          marginTop: 0,
          marginBottom: "1.5rem",
          fontSize: "1.25rem",
          letterSpacing: "0.01em",
        }}
      >
        {title}
      </h4>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: columnTemplate,
          columnGap: "1.2rem",
          rowGap: "0.95rem",
          fontSize: "1rem",
          lineHeight: 1.4,
        }}
      >
        {columns.map((col, idx) => (
          <span
            key={col}
            style={{
              opacity: 0.55,
              fontSize: "0.85rem",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              textAlign: idx === columns.length - 1 ? "right" : "left",
            }}
          >
            {col}
          </span>
        ))}
        {rows.map((row, idx) => (
          <Fragment key={idx}>
            {columns.map((col, colIdx) => (
              <span
                key={`${idx}-${col}`}
                style={{
                  fontVariantNumeric: "tabular-nums",
                  fontWeight: colIdx === 0 ? 600 : 500,
                  opacity: 0.95,
                  textAlign: colIdx === columns.length - 1 ? "right" : "left",
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
  const topPhrases = overall?.map((item) => ({
    Phrase: item.phrase || item.text || "—",
    Count: item.occurrences?.toLocaleString?.() ?? item.occurrences,
  }));

  const signatureRows = signature?.map((entry) => ({
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
    <div style={{ marginTop: "3rem" }}>
      <h3 style={{ fontSize: "1.6rem", marginBottom: "1.5rem" }}>
        📝 Signature Phrases
      </h3>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "2rem",
        }}
      >
        <PhraseTable
          title="Most Used Phrases"
          rows={topPhrases}
          columns={["Phrase", "Count"]}
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
