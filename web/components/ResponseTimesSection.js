import StatCard from "./StatCard";
import EnhancedText from "./EnhancedText";
import { useEnhancement, PLAYFUL_INSTRUCTION } from "@/hooks/useEnhancement";

function buildPercentileContext(percentile, totalWraps) {
  if (percentile === undefined || percentile === null || totalWraps <= 0) {
    return "";
  }
  return ` You're faster than ${percentile}% of ${totalWraps.toLocaleString()} users.`;
}

export default function ResponseTimesSection({ response_times, percentiles = {}, ranks = {}, metricCounts = {}, totalWraps = 0 }) {
  const hasData =
    response_times &&
    (response_times.total_responses_you > 0 ||
      response_times.total_responses_them > 0);
  const hasBoth =
    response_times?.total_responses_you > 0 &&
    response_times?.total_responses_them > 0;

  const yourPercentile = percentiles["response_times.median_response_time_you_seconds"];
  const theirPercentile = percentiles["response_times.median_response_time_them_seconds"];
  
  const percentileContext = buildPercentileContext(yourPercentile, totalWraps);

  const prompt = hasBoth
    ? `Our median response time is ${response_times.median_response_time_you_formatted}, theirs is ${response_times.median_response_time_them_formatted}.${percentileContext} ${PLAYFUL_INSTRUCTION}`
    : null;

  const { enhancement, loading } = useEnhancement(prompt, hasBoth);

  if (!hasData) {
    return null;
  }

  return (
    <div className="section">
      <h2 className="section-title">⚡ Response Times</h2>
      {enhancement && (
        <EnhancedText style={{ marginTop: "0.5rem" }}>
          {enhancement}
        </EnhancedText>
      )}
      <div className="stats-grid">
        {response_times.total_responses_you > 0 &&
          response_times.median_response_time_you_formatted && (
            <StatCard
              label="Your Median Response Time"
              value={response_times.median_response_time_you_formatted}
              percentile={percentiles["response_times.median_response_time_you_seconds"]}
              rank={ranks["response_times.median_response_time_you_seconds"]}
              metricTotal={metricCounts["response_times.median_response_time_you_seconds"]}
              totalWraps={totalWraps}
              valueStyle={{ fontSize: "2rem", color: "#10b981" }}
            />
          )}
        {response_times.total_responses_them > 0 &&
          response_times.median_response_time_them_formatted && (
            <StatCard
              label="Their Median Response Time"
              value={response_times.median_response_time_them_formatted}
              percentile={percentiles["response_times.median_response_time_them_seconds"]}
              rank={ranks["response_times.median_response_time_them_seconds"]}
              metricTotal={metricCounts["response_times.median_response_time_them_seconds"]}
              totalWraps={totalWraps}
              valueStyle={{ fontSize: "2rem", color: "#10b981" }}
            />
          )}
      </div>
    </div>
  );
}
