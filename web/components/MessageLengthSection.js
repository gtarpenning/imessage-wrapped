import StatCard from "./StatCard";
import { useEnhancement, PLAYFUL_INSTRUCTION } from "@/hooks/useEnhancement";
import { Histogram, getWarmColorGradient } from "@/lib/histogram";

export default function MessageLengthSection({ content }) {
  if (!content) return null;

  const hasLengthData =
    content.avg_message_length_sent !== undefined ||
    content.avg_message_length_received !== undefined;

  if (!hasLengthData) return null;

  return (
    <div className="section">
      <h2 className="section-title">📏 Message Length</h2>

      <div className="stats-grid">
        {content.avg_message_length_sent !== undefined && (
          <StatCard
            label="Avg Length (Sent)"
            value={`${Math.round(content.avg_message_length_sent)} chars`}
            valueStyle={{ fontSize: "2rem" }}
          />
        )}
        {content.avg_message_length_received !== undefined && (
          <StatCard
            label="Avg Length (Received)"
            value={`${Math.round(content.avg_message_length_received)} chars`}
            valueStyle={{ fontSize: "2rem" }}
          />
        )}
        {content.avg_word_count_sent !== undefined && (
          <StatCard
            label="Avg Words (Sent)"
            value={`${Math.round(content.avg_word_count_sent)} words`}
            valueStyle={{ fontSize: "2rem" }}
          />
        )}
      </div>

      {content.word_count_histogram && Object.keys(content.word_count_histogram).length > 0 && (
        <WordCountHistogram
          histogram={content.word_count_histogram}
          modeWordCount={content.mode_word_count}
        />
      )}
    </div>
  );
}

function WordCountHistogram({ histogram, modeWordCount }) {
  const prompt = modeWordCount
    ? `Your most common message length is ${modeWordCount} words. Categorize this messaging style with a playful category name like (doesn't have to be exact) "sniper" (1-5 words), "conversationalist" (6-15 words), "essayist" (50+ words), etc. ${PLAYFUL_INSTRUCTION}`
    : null;

  const { enhancement } = useEnhancement(prompt, !!prompt);

  const wordCountHistogramConfig = {
    processData: (histogram) => {
      const entries = Object.entries(histogram)
        .map(([wordCount, count]) => [parseInt(wordCount, 10), parseInt(count, 10)])
        .filter(([wordCount, count]) => !isNaN(wordCount) && !isNaN(count) && count > 0);

      if (entries.length === 0) {
        return { buckets: [], maxCount: 0 };
      }

      entries.sort((a, b) => a[0] - b[0]);

      const counts = entries.map(([, count]) => count);
      const wordCounts = entries.map(([wordCount]) => wordCount);
      const maxCount = Math.max(...counts);
      const actualMaxWordCount = Math.max(...wordCounts);
      const cappedMaxWordCount = 60;

      if (maxCount === 0 || actualMaxWordCount === 0) {
        return { buckets: [], maxCount: 0 };
      }

      const buckets = [];
      const bucketSize = 1;

      for (let i = 1; i <= cappedMaxWordCount; i += bucketSize) {
        const bucketEnd = i;
        let bucketCount = 0;
        for (const [wordCount, count] of entries) {
          if (wordCount === i) {
            bucketCount += count;
          }
        }
        buckets.push({
          range: `${i}`,
          start: i,
          end: bucketEnd,
          count: bucketCount,
        });
      }

      if (actualMaxWordCount > cappedMaxWordCount) {
        let overflowCount = 0;
        for (const [wordCount, count] of entries) {
          if (wordCount > cappedMaxWordCount) {
            overflowCount += count;
          }
        }
        if (overflowCount > 0) {
          buckets.push({
            range: "60+",
            start: cappedMaxWordCount + 1,
            end: actualMaxWordCount,
            count: overflowCount,
          });
        }
      }

      const maxBucketCount = Math.max(...buckets.map(b => b.count), 0);

      return { buckets, maxCount: maxBucketCount || maxCount, maxWordCount: actualMaxWordCount };
    },
    generateTicks: (buckets) => {
      const tickInterval = 10;
      const ticks = [];
      const hasOverflow = buckets.some(b => b.range === "60+");
      const cappedMaxWordCount = 60;
      const maxTick = hasOverflow ? cappedMaxWordCount - tickInterval : cappedMaxWordCount;
      
      for (let i = 10; i <= maxTick; i += tickInterval) {
        ticks.push(i);
      }
      if (!hasOverflow) {
        ticks.push(cappedMaxWordCount);
      }
      return ticks;
    },
    formatLabel: (bucket) => `${bucket.range} words`,
    formatValue: (bucket) => `${bucket.count.toLocaleString()} messages`,
    formatTick: (tick) => tick,
    getBarStyle: (bucket, allBuckets) => {
      const maxCount = allBuckets.reduce((max, b) => Math.max(max, b.count), 0);
      return getWarmColorGradient(bucket.count, maxCount);
    },
    getBucketKey: (bucket) => bucket.start,
    renderExtra: (buckets) => {
      const hasOverflowBucket = buckets.some(b => b.range === "60+");
      const lastBucketIndex = buckets.length - 1;
      const labelStyle = {
        position: "absolute",
        fontSize: "0.75rem",
        whiteSpace: "nowrap",
      };

      return (
        <>
          {hasOverflowBucket && (
            <div
              style={{
                ...labelStyle,
                left: `${((lastBucketIndex + 0.5) / buckets.length) * 100}%`,
                transform: "translateX(-50%)",
                opacity: 0.6,
              }}
            >
              60+
            </div>
          )}
        </>
      );
    },
  };

  return (
    <Histogram
      histogram={histogram}
      config={wordCountHistogramConfig}
      title="Message Length Distribution"
      enhancement={enhancement}
      highlightLargest={false}
      xAxisLabel="Words per message"
    />
  );
}
