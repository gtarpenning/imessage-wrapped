"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  ComparisonHeroSection,
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
import UnlockButton from "@/components/UnlockButton";
import { applyHydratedData } from "@/lib/hydration";

export default function ComparisonPage() {
  const params = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Unlock state for comparison
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [hydratedData1, setHydratedData1] = useState(null);
  const [hydratedData2, setHydratedData2] = useState(null);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState(null);

  const unlock = useCallback(async (unlockCode) => {
    if (!data || !data.year1_id || !data.year2_id) {
      setUnlockError("Data not loaded yet");
      return false;
    }

    setIsUnlocking(true);
    setUnlockError(null);

    try {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "") || "";
      
      // Unlock both years
      const [response1, response2] = await Promise.all([
        fetch(`${baseUrl}/api/unlock/${data.year1}/${data.year1_id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ unlock_code: unlockCode.trim() }),
        }),
        fetch(`${baseUrl}/api/unlock/${data.year2}/${data.year2_id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ unlock_code: unlockCode.trim() }),
        }),
      ]);

      if (!response1.ok) {
        const data1 = await response1.json();
        throw new Error(data1.error || "Failed to unlock year 1");
      }

      if (!response2.ok) {
        const data2 = await response2.json();
        throw new Error(data2.error || "Failed to unlock year 2");
      }

      const [data1, data2] = await Promise.all([response1.json(), response2.json()]);

      if (data1.success && data2.success) {
        setHydratedData1(data1.hydrated_data || {});
        setHydratedData2(data2.hydrated_data || {});
        setIsUnlocked(true);
        return true;
      } else {
        throw new Error("Invalid response from server");
      }
    } catch (err) {
      console.error("Unlock error:", err);
      setUnlockError(err.message || "Failed to unlock");
      return false;
    } finally {
      setIsUnlocking(false);
    }
  }, [data]);

  const reset = useCallback(() => {
    setIsUnlocked(false);
    setHydratedData1(null);
    setHydratedData2(null);
    setUnlockError(null);
  }, []);

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

  // Apply hydrated data if unlocked
  let stats1 = data.year1_statistics?.raw || data.year1_statistics;
  let stats2 = data.year2_statistics?.raw || data.year2_statistics;
  
  if (isUnlocked) {
    if (hydratedData1) {
      stats1 = applyHydratedData(stats1, hydratedData1);
    }
    if (hydratedData2) {
      stats2 = applyHydratedData(stats2, hydratedData2);
    }
  }
  
  const year1 = data.year1;
  const year2 = data.year2;
  const userName = data.year1_user_name || data.year2_user_name || null;
  
  // For comparison, we need to check if contact data is available
  // This would need to be passed from the API, but for now we'll skip the banner on comparisons
  const hasContactData = false; // TODO: Check if comparison has contact data

  return (
    <>
      {hasContactData && (
        <UnlockButton 
          isUnlocked={isUnlocked}
          isUnlocking={isUnlocking}
          error={unlockError}
          onUnlock={unlock}
          onReset={reset}
          hasContactData={hasContactData}
        />
      )}
      <main className="container comparison-view">
        <ComparisonHeroSection
          year1={year1}
          year2={year2}
          volume1={stats1.volume}
          volume2={stats2.volume}
          userName={userName}
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
    </>
  );
}

