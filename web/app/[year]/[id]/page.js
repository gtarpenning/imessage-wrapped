"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import HeroSection from "@/components/HeroSection";
import VolumeSection from "@/components/VolumeSection";
import HeatmapSection from "@/components/HeatmapSection";
import ContactsSection from "@/components/ContactsSection";
import TemporalSection from "@/components/TemporalSection";
import ContentSection from "@/components/ContentSection";
import MessageAnalysisSection from "@/components/MessageAnalysisSection";
import MessageLengthSection from "@/components/MessageLengthSection";
import ConversationsSection from "@/components/ConversationsSection";
import GhostSection from "@/components/GhostSection";
import ResponseTimesSection from "@/components/ResponseTimesSection";
import TapbacksSection from "@/components/TapbacksSection";
import StreaksSection from "@/components/StreaksSection";
import WrappedFooter from "@/components/WrappedFooter";

export default function WrappedPage() {
  const params = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const baseUrl =
          process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "") || "";
        const endpoint = `${baseUrl}/api/wrapped/${params.year}/${params.id}`;
        const response = await fetch(
          endpoint,
        );

        if (!response.ok) {
          throw new Error("Wrapped not found");
        }

        const json = await response.json();
        setData(json);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [params.year, params.id]);

  if (loading) {
    return <div className="loading">Loading your Wrapped...</div>;
  }

  if (error) {
    return (
      <div className="error">
        <h1>404</h1>
        <p>{error}</p>
        <p style={{ marginTop: "1rem", opacity: 0.6 }}>
          This Wrapped might have expired or the link is incorrect.
        </p>
      </div>
    );
  }

  const stats = data.statistics?.raw || data.statistics;

  return (
    <main className="container">
      <HeroSection year={data.year} volume={stats.volume} />
      <VolumeSection volume={stats.volume} />
      <HeatmapSection volume={stats.volume} year={data.year} />
      <ContactsSection contacts={stats.contacts} />
      <TemporalSection temporal={stats.temporal} />
      <ContentSection content={stats.content} />
      <MessageAnalysisSection sentiment={stats.content?.sentiment} />
      <MessageLengthSection content={stats.content} />
      <ConversationsSection conversations={stats.conversations} />
      <GhostSection ghosts={stats.ghosts} />
      <ResponseTimesSection response_times={stats.response_times} />
      <TapbacksSection tapbacks={stats.tapbacks} />
      <StreaksSection streaks={stats.streaks} />
      <WrappedFooter views={data.views} volume={stats.volume} />
    </main>
  );
}
