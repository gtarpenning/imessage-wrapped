export default function EnhancedText({ children, style = {} }) {
  if (!children) return null;

  const cleanText = typeof children === "string" 
    ? children.replace(/^["']+|["']+$/g, "").trim()
    : String(children).replace(/^["']+|["']+$/g, "").trim();

  const leftDelay = Math.random() * 2;
  const rightDelay = Math.random() * 2;
  const leftDuration = 2.5 + Math.random() * 1;
  const rightDuration = 2.5 + Math.random() * 1;

  return (
    <p
      style={{
        marginTop: "0",
        marginBottom: "1rem",
        fontSize: "1.5rem",
        fontWeight: "500",
        opacity: 0.85,
        fontStyle: "italic",
        textAlign: "center",
        lineHeight: "1.4",
        position: "relative",
        display: "block",
        padding: "0 1.5rem",
        ...style,
      }}
      className="enhanced-text"
    >
      <span 
        className="sparkle sparkle-left"
        style={{
          animationDelay: `${leftDelay}s`,
          animationDuration: `${leftDuration}s`,
        }}
      >
        ✨
      </span>
      {cleanText}
      <span 
        className="sparkle sparkle-right"
        style={{
          animationDelay: `${rightDelay}s`,
          animationDuration: `${rightDuration}s`,
        }}
      >
        ✨
      </span>
    </p>
  );
}

