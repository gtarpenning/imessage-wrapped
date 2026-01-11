import { useEnhancement } from "@/hooks/useEnhancement";
import EnhancedText from "./EnhancedText";

export default function WrappedFooter({ views, volume, isComparison = false, percentiles = {}, ranks = {}, metricCounts = {}, totalWraps = 0 }) {
  const totalMessages = volume
    ? (volume.total_sent || 0) + (volume.total_received || 0)
    : 0;

  const volumePercentile = percentiles["volume.total_sent"];
  const percentileContext = volumePercentile !== undefined && volumePercentile !== null && totalWraps > 0
    ? ` This person is more active than ${volumePercentile}% of ${totalWraps.toLocaleString()} users.`
    : "";

  const enhancementPrompt = !isComparison && totalMessages > 0
      ? `You just saw someone send ${totalMessages.toLocaleString()} messages this year.${percentileContext} Write a spicy, provocative, ` +
        `attention-grabbing call-to-action (under 15 words) encouraging the viewer to click the button to create ` +
        `their own analysis. Be bold and playful. Use past tense example: Think you topped ${totalMessages.toLocaleString()} texts?`
      : null;

  const { enhancement, loading } = useEnhancement(
    enhancementPrompt,
    !!enhancementPrompt,
  );

  return (
    <footer
      style={{
        textAlign: "center",
        padding: "4rem 2rem",
        marginTop: "4rem",
        background: "rgba(139, 92, 246, 0.1)",
        borderRadius: "2rem",
        border: "1px solid rgba(139, 92, 246, 0.2)",
      }}
    >
      {enhancement && (
        <EnhancedText
          style={{
            fontSize: "1.5rem",
            fontWeight: "600",
            marginBottom: "2rem",
            color: "#fff",
          }}
        >
          {enhancement}
        </EnhancedText>
      )}
      {loading && (
        <p
          style={{
            fontSize: "1.2rem",
            marginBottom: "2rem",
            opacity: 0.6,
          }}
        >
          ✨
        </p>
      )}

      <a
        href="/"
        style={{
          display: "inline-block",
          padding: "1rem 2.5rem",
          background: "linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)",
          color: "#fff",
          textDecoration: "none",
          borderRadius: "2rem",
          fontSize: "1.2rem",
          fontWeight: "600",
          transition: "transform 0.2s, box-shadow 0.2s",
          boxShadow: "0 4px 15px rgba(139, 92, 246, 0.4)",
          border: "none",
          cursor: "pointer",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "translateY(-2px)";
          e.currentTarget.style.boxShadow =
            "0 6px 20px rgba(139, 92, 246, 0.6)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.boxShadow =
            "0 4px 15px rgba(139, 92, 246, 0.4)";
        }}
      >
        Create Your Own Wrapped →
      </a>

      {views !== undefined && (
        <p
          style={{
            marginTop: "2rem",
            fontSize: "0.9rem",
            opacity: 0.5,
          }}
        >
          {views} {views === 1 ? "view" : "views"}
        </p>
      )}
    </footer>
  );
}
