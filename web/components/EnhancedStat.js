import { useEnhancement, PLAYFUL_INSTRUCTION } from "@/hooks/useEnhancement";
import EnhancedText from "./EnhancedText";

export default function EnhancedStat({ prompt, children, className = "" }) {
  const fullPrompt = prompt ? `${prompt} ${PLAYFUL_INSTRUCTION}` : null;
  const { enhancement, loading } = useEnhancement(fullPrompt, !!fullPrompt);

  return (
    <div className={className}>
      {children}
      {enhancement && (
        <EnhancedText style={{ marginTop: "1.5rem" }}>
          {enhancement}
        </EnhancedText>
      )}
      {loading && (
        <p
          style={{
            marginTop: "0.5rem",
            fontSize: "0.8rem",
            opacity: 0.5,
          }}
        >
          ✨
        </p>
      )}
    </div>
  );
}
