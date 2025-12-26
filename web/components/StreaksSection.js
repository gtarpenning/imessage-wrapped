import { useEnhancement, PLAYFUL_INSTRUCTION } from '@/hooks/useEnhancement'

export default function StreaksSection({ streaks }) {
  const hasStreak = !!streaks?.longest_streak_days
  const prompt = hasStreak
    ? `You had a ${streaks.longest_streak_days} day messaging streak. ${PLAYFUL_INSTRUCTION}`
    : null
  const { enhancement } = useEnhancement(prompt, hasStreak)
  const title = enhancement || '🔥 Your Longest Streak'
  
  if (!hasStreak) return null

  return (
    <div className="section">
      <h2 className="section-title" style={{
        fontStyle: enhancement ? 'italic' : 'normal',
        fontSize: enhancement ? '1.5rem' : undefined
      }}>
        {title}
      </h2>
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: '3rem', fontWeight: 'bold', color: '#f59e0b' }}>
          {streaks.longest_streak_days} days
        </p>
      </div>
    </div>
  )
}

