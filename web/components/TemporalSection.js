const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export default function TemporalSection({ temporal }) {
  if (!temporal) return null

  return (
    <div className="section">
      <h2 className="section-title">⏰ When You Text</h2>
      {temporal.busiest_hour && (
        <div style={{ marginBottom: '2rem' }}>
          <p style={{ opacity: 0.8 }}>Busiest Hour:</p>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#06b6d4' }}>
            {temporal.busiest_hour[0]}:00 ({temporal.busiest_hour[1]} messages)
          </p>
        </div>
      )}
      {temporal.busiest_day_of_week && (
        <div>
          <p style={{ opacity: 0.8 }}>Busiest Day of Week:</p>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#06b6d4' }}>
            {DAY_NAMES[temporal.busiest_day_of_week[0]]} ({temporal.busiest_day_of_week[1]} messages)
          </p>
        </div>
      )}
    </div>
  )
}

