"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import HeroSection from "@/components/HeroSection";
import HeatmapSection from "@/components/HeatmapSection";
import ContactsSection from "@/components/ContactsSection";
import TemporalSection from "@/components/TemporalSection";
import ContentSection from "@/components/ContentSection";
import MessageAnalysisSection from "@/components/MessageAnalysisSection";
import MessageLengthSection from "@/components/MessageLengthSection";
import ConversationsSection from "@/components/ConversationsSection";
import GhostSection from "@/components/GhostSection";
// import CliffhangerSection from "@/components/CliffhangerSection";
import ResponseTimesSection from "@/components/ResponseTimesSection";
import TapbacksSection from "@/components/TapbacksSection";
import StreaksSection from "@/components/StreaksSection";
import WrappedFooter from "@/components/WrappedFooter";
import UnlockButton from "@/components/UnlockButton";
import { useUnlock } from "@/hooks/useUnlock";
import { applyHydratedData } from "@/lib/hydration";

export default function WrappedPage() {
  const params = useParams();
  const [data, setData] = useState(null);
  const [percentiles, setPercentiles] = useState({});
  const [ranks, setRanks] = useState({});
  const [metricCounts, setMetricCounts] = useState({});
  const [totalWraps, setTotalWraps] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Initialize unlock functionality
  const { isUnlocked, hydratedData, isUnlocking, error: unlockError, unlock, reset, checkStoredUnlock } = useUnlock(params.year, params.id);

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

        // Fetch percentiles
        const percentileEndpoint = `${baseUrl}/api/percentiles/${params.year}/${params.id}`;
        const percentileResponse = await fetch(percentileEndpoint);
        
        if (percentileResponse.ok) {
          const percentileData = await percentileResponse.json();
          setPercentiles(percentileData.percentiles || {});
          setRanks(percentileData.ranks || {});
          setMetricCounts(percentileData.metricCounts || {});
          setTotalWraps(percentileData.total || 0);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
    // Check if already unlocked in sessionStorage
    checkStoredUnlock();
  }, [params.year, params.id, checkStoredUnlock]);

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

  // Apply hydrated data if unlocked
  let stats = data.statistics?.raw || data.statistics;
  if (isUnlocked && hydratedData) {
    stats = applyHydratedData(stats, hydratedData);
  }
  
  const userName = data.user_name || null;
  
  // Check if this wrapped has contact data available (has unlock_code in metadata)
  const hasContactData = data.metadata?.unlock_code ? true : false;

  return (
    <>
      <UnlockButton 
        isUnlocked={isUnlocked}
        isUnlocking={isUnlocking}
        error={unlockError}
        onUnlock={unlock}
        onReset={reset}
        hasContactData={hasContactData}
      />
      <main className="container">
        <HeroSection year={data.year} volume={stats.volume} percentiles={percentiles} ranks={ranks} metricCounts={metricCounts} totalWraps={totalWraps} userName={userName} />
        <HeatmapSection volume={stats.volume} year={data.year} />
        <TemporalSection temporal={stats.temporal} />
        <ContactsSection contacts={stats.contacts} percentiles={percentiles} ranks={ranks} metricCounts={metricCounts} totalWraps={totalWraps} />
        <ContentSection content={stats.content} percentiles={percentiles} ranks={ranks} metricCounts={metricCounts} totalWraps={totalWraps} />
        <MessageAnalysisSection sentiment={stats.content?.sentiment} />
        <MessageLengthSection content={stats.content} percentiles={percentiles} ranks={ranks} metricCounts={metricCounts} totalWraps={totalWraps} />
        <ConversationsSection conversations={stats.conversations} percentiles={percentiles} ranks={ranks} metricCounts={metricCounts} totalWraps={totalWraps} />
        <GhostSection ghosts={stats.ghosts} percentiles={percentiles} ranks={ranks} metricCounts={metricCounts} totalWraps={totalWraps} />
        {/* <CliffhangerSection cliffhangers={stats.cliffhangers} /> */}
        <ResponseTimesSection response_times={stats.response_times} percentiles={percentiles} ranks={ranks} metricCounts={metricCounts} totalWraps={totalWraps} />
        <TapbacksSection tapbacks={stats.tapbacks} percentiles={percentiles} ranks={ranks} metricCounts={metricCounts} totalWraps={totalWraps} />
        <StreaksSection streaks={stats.streaks} percentiles={percentiles} ranks={ranks} metricCounts={metricCounts} totalWraps={totalWraps} />
        <WrappedFooter views={data.views} volume={stats.volume} percentiles={percentiles} ranks={ranks} metricCounts={metricCounts} totalWraps={totalWraps} />
      </main>
    </>
  );
}
