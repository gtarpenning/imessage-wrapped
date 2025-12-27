function ExampleList({ title, examples }) {
  if (!examples || examples.length === 0) return null;

  return (
    <div className="cliffhanger-example-group">
      <h4>{title}</h4>
      <ul className="cliffhanger-examples">
        {examples.slice(0, 3).map((example, idx) => (
          <li key={`${title}-${idx}`}>
            <div className="cliffhanger-example-header">
              <strong>{example.contact || "Unknown"}</strong>
              {typeof example.hours_waited === "number" && (
                <span>{example.hours_waited.toFixed(1)}h wait</span>
              )}
            </div>
            <p>“{(example.snippet || "").trim()}”</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function CliffhangerSection({ cliffhangers }) {
  const hasData = cliffhangers && (cliffhangers.count || cliffhangers.count_them);
  if (!hasData) return null;

  const countYou = cliffhangers.count || 0;
  const countThem = cliffhangers.count_them || 0;
  const threshold = cliffhangers.threshold_hours || 12;
  const longestWaitYou = cliffhangers.longest_wait_hours;
  const longestWaitThem = cliffhangers.longest_wait_hours_them;
  const chartData = [
    { key: "you", label: "You dangled", value: countYou, color: "#c084fc" },
    { key: "them", label: "They dangled you", value: countThem, color: "#fb7185" },
  ];
  const maxValue = Math.max(...chartData.map((item) => item.value), 1);

  return (
    <div className="section">
      <h2 className="section-title">🧵 Cliffhangers</h2>
      <div className="cliffhanger-intro">
        <p>
          You dangled future tea <strong>{countYou}</strong>{" "}
          {countYou === 1 ? "time" : "times"} and waited at least {threshold} hours before
          circling back
          {typeof longestWaitYou === "number" && longestWaitYou > 0
            ? ` (longest stretch: ${longestWaitYou.toFixed(1)}h)`
            : ""}
          .
        </p>
        {countThem > 0 && (
          <p>
            Your friends returned the favor <strong>{countThem}</strong>{" "}
            {countThem === 1 ? "time" : "times"}, making you wait just as long
            {typeof longestWaitThem === "number" && longestWaitThem > 0
              ? ` (up to ${longestWaitThem.toFixed(1)}h)`
              : ""}
            .
          </p>
        )}
      </div>
      <div className="cliffhanger-chart">
        {chartData.map((item) => (
          <div key={item.key} className="cliffhanger-bar">
            <div className="cliffhanger-bar-label">
              <span>{item.label}</span>
              <span>{item.value.toLocaleString()}</span>
            </div>
            <div className="cliffhanger-bar-track" aria-hidden="true">
              <div
                className="cliffhanger-bar-fill"
                style={{
                  width: `${(item.value / maxValue) * 100}%`,
                  background: item.color,
                }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="cliffhanger-examples-grid">
        <ExampleList title="Your slowest follow-ups" examples={cliffhangers.examples} />
        <ExampleList title="Times they left you waiting" examples={cliffhangers.examples_them} />
      </div>
    </div>
  );
}
