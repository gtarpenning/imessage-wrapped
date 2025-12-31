"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  ComparisonHeroSection,
  ComparisonHeatmapSection,
  ComparisonContactsSection,
  ComparisonTemporalSection,
  ComparisonContentSection,
  ComparisonSentimentSection,
  ComparisonConversationsSection,
  ComparisonGhostSection,
  ComparisonResponseTimesSection,
  ComparisonTapbacksSection,
  ComparisonStreaksSection,
} from "@/components/comparison";
import WrappedFooter from "@/components/WrappedFooter";

export default function ComparisonPage() {
  const params = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const baseUrl =
          process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "") || "";
        const endpoint = `${baseUrl}/api/compare/${params.years}/${params.id}`;
        const response = await fetch(endpoint);

        if (!response.ok) {
          throw new Error("Comparison not found");
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
  }, [params.years, params.id]);

  if (loading) {
    return <div className="loading">Loading your comparison...</div>;
  }

  if (error) {
    return (
      <div className="error">
        <h1>404</h1>
        <p>{error}</p>
        <p style={{ marginTop: "1rem", opacity: 0.6 }}>
          This comparison might have expired or the link is incorrect.
        </p>
      </div>
    );
  }

  const stats1 = data.year1_statistics?.raw || data.year1_statistics;
  const stats2 = data.year2_statistics?.raw || data.year2_statistics;
  const year1 = data.year1;
  const year2 = data.year2;
  const userName = data.year1_user_name || data.year2_user_name || null;

  return (
    <main className="container comparison-view">
      <ComparisonHeroSection
        year1={year1}
        year2={year2}
        volume1={stats1.volume}
        volume2={stats2.volume}
        userName={userName}
      />
      
      <ComparisonHeatmapSection
        volume1={stats1.volume}
        volume2={stats2.volume}
        year1={year1}
        year2={year2}
      />
      
      <ComparisonTemporalSection
        temporal1={stats1.temporal}
        temporal2={stats2.temporal}
        year1={year1}
        year2={year2}
      />
      
      <ComparisonContactsSection
        contacts1={stats1.contacts}
        contacts2={stats2.contacts}
        year1={year1}
        year2={year2}
      />
      
      <ComparisonContentSection
        content1={stats1.content}
        content2={stats2.content}
        year1={year1}
        year2={year2}
      />
      
      <ComparisonSentimentSection
        sentiment1={stats1.content?.sentiment}
        sentiment2={stats2.content?.sentiment}
        year1={year1}
        year2={year2}
      />
      
      <ComparisonConversationsSection
        conversations1={stats1.conversations}
        conversations2={stats2.conversations}
        year1={year1}
        year2={year2}
      />
      
      <ComparisonGhostSection
        ghosts1={stats1.ghosts}
        ghosts2={stats2.ghosts}
        year1={year1}
        year2={year2}
      />
      
      <ComparisonResponseTimesSection
        response_times1={stats1.response_times}
        response_times2={stats2.response_times}
        year1={year1}
        year2={year2}
      />
      
      <ComparisonTapbacksSection
        tapbacks1={stats1.tapbacks}
        tapbacks2={stats2.tapbacks}
        year1={year1}
        year2={year2}
      />
      
      <ComparisonStreaksSection
        streaks1={stats1.streaks}
        streaks2={stats2.streaks}
        year1={year1}
        year2={year2}
      />
      
      <WrappedFooter views={data.views} volume={null} isComparison={true} />
    </main>
  );
}

