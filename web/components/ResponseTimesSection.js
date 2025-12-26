import StatCard from './StatCard'
import { useEnhancement, PLAYFUL_INSTRUCTION } from '@/hooks/useEnhancement'

export default function ResponseTimesSection({ response_times }) {
  const hasData = response_times && (response_times.total_responses_you > 0 || response_times.total_responses_them > 0)
  const hasBoth = response_times?.total_responses_you > 0 && response_times?.total_responses_them > 0
  
  const prompt = hasBoth
    ? `Our median response time is ${response_times.median_response_time_you_formatted}, theirs is ${response_times.median_response_time_them_formatted}. ${PLAYFUL_INSTRUCTION}`
    : null

  const { enhancement, loading } = useEnhancement(prompt, hasBoth)
  
  if (!hasData) {
    return null
  }
  const defaultTitle = '⚡ Response Times'
  const title = enhancement || defaultTitle

  return (
    <div className="section">
      <h2 className="section-title" style={{
        fontStyle: enhancement ? 'italic' : 'normal',
        fontSize: enhancement ? '1.5rem' : undefined
      }}>
        {title}
      </h2>
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

