export default function StreaksSection({ streaks }) {
  if (!streaks?.longest_streak_days) return null

  return (
    <div className="section">
      <h2 className="section-title">🔥 Your Longest Streak</h2>
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: '3rem', fontWeight: 'bold', color: '#f59e0b' }}>
          {streaks.longest_streak_days} days
        </p>
        <p style={{ opacity: 0.8, marginTop: '1rem' }}>
          with {streaks.longest_streak_contact}
        </p>
      </div>
    </div>
  )
}

