"use client";

import { useEffect, useState } from "react";

function ScrollHint() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.scrollY > 0) return;

    let timeoutId = null;
    const onScroll = () => {
      if (window.scrollY > 0) setVisible(false);
    };

    timeoutId = window.setTimeout(() => {
      if (window.scrollY === 0) setVisible(true);
    }, 2000);

    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      if (timeoutId) window.clearTimeout(timeoutId);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  if (!visible) return null;

  return (
    <>
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          right: "1.25rem",
          bottom: "1.25rem",
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          padding: "0.6rem 0.9rem",
          borderRadius: "999px",
          background: "rgba(0,0,0,0.4)",
          border: "1px solid rgba(255,255,255,0.15)",
          color: "white",
          fontSize: "0.9rem",
          letterSpacing: "0.02em",
          animation: "scroll-hint-bob 1.6s ease-in-out infinite",
          zIndex: 20,
        }}
      >
        <span style={{ opacity: 0.8 }}>Scroll</span>
        <span style={{ fontSize: "1.1rem" }}>↓</span>
      </div>
      <style jsx global>{`
        @keyframes scroll-hint-bob {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-6px);
          }
        }
      `}</style>
    </>
  );
}

export default function Home() {
  return (
    <main className="container">
      <div className="hero">
        <h1>
          iMessage <span className="gradient-text">Wrapped</span>
        </h1>
        <p style={{ fontSize: "1.5rem", marginBottom: "2rem", opacity: 0.8 }}>
          Your year in messages, visualized
        </p>

        <div
          style={{
            display: "flex",
            gap: "1rem",
            marginBottom: "2rem",
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          <a
            href="/api/download"
            style={{
              background: "linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)",
              color: "white",
              padding: "1rem 2rem",
              borderRadius: "0.75rem",
              textDecoration: "none",
              fontWeight: "600",
              fontSize: "1.1rem",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              transition: "transform 0.2s",
            }}
            onMouseEnter={(e) => (e.target.style.transform = "scale(1.05)")}
            onMouseLeave={(e) => (e.target.style.transform = "scale(1)")}
          >
            🖥️ Download for macOS
          </a>
        </div>

        <div
          style={{
            background: "rgba(255,255,255,0.1)",
            padding: "2rem",
            borderRadius: "1rem",
            maxWidth: "600px",
          }}
        >
          <p
            style={{ marginBottom: "1rem", opacity: 0.8, textAlign: "center" }}
          >
            Or use the command line:
          </p>
          <pre
            style={{
              background: "rgba(0,0,0,0.3)",
              padding: "1rem",
              borderRadius: "0.5rem",
              textAlign: "left",
              maxWidth: "500px",
              margin: "0 auto",
              overflow: "auto",
            }}
          >
            <code>pip install imessage-wrapped{"\n"}imexport analyze</code>
          </pre>
          <p style={{ marginTop: "1.5rem", opacity: 0.7, textAlign: "center" }}>
            <a
              href="https://github.com/gtarpenning/imessage-wrapped"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "#8b5cf6", textDecoration: "none" }}
            >
              View on GitHub →
            </a>
          </p>
        </div>
      </div>
      <ScrollHint />
    </main>
  );
}
