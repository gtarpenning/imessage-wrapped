import StatCard from './StatCard'

export default function ResponseTimesSection({ response_times }) {
  if (!response_times || (response_times.total_responses_you === 0 && response_times.total_responses_them === 0)) {
    return null
  }

  return (
    <div className="section">
      <h2 className="section-title">⚡ Response Times</h2>
      <div className="stats-grid">
        {response_times.total_responses_you > 0 && response_times.median_response_time_you_formatted && (
          <StatCard 
            label="Your Median Response Time" 
            value={response_times.median_response_time_you_formatted}
            valueStyle={{ fontSize: '2rem', color: '#10b981' }}
          />
        )}
        {response_times.total_responses_them > 0 && response_times.median_response_time_them_formatted && (
          <StatCard 
            label="Their Median Response Time" 
            value={response_times.median_response_time_them_formatted}
            valueStyle={{ fontSize: '2rem', color: '#10b981' }}
          />
        )}
      </div>
    </div>
  )
}

