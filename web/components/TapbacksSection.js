import StatCard from './StatCard'

const TAPBACK_EMOJIS = {
  'love': '❤️',
  'like': '👍',
  'laugh': '😂',
  'emphasize': '❗',
  'dislike': '👎',
  'question': '❓'
}

const TAPBACK_LABELS = {
  'love': 'Love',
  'like': 'Like',
  'laugh': 'Laugh',
  'emphasize': 'Emphasize',
  'dislike': 'Dislike',
  'question': 'Question'
}

export default function TapbacksSection({ tapbacks }) {
  if (!tapbacks || (tapbacks.total_tapbacks_given === 0 && tapbacks.total_tapbacks_received === 0)) {
    return null
  }

  const tapbackDistribution = tapbacks.tapback_distribution_given || {}
  const orderedTapbacks = Object.entries(tapbackDistribution)
    .sort((a, b) => b[1] - a[1])
    .map(([type]) => type)

  return (
    <div className="section">
      <h2 className="section-title">❤️ Reactions & Tapbacks</h2>
      
      <div className="stats-grid">
        {tapbacks.total_tapbacks_given > 0 && (
          <StatCard 
            label="Tapbacks Given" 
            value={tapbacks.total_tapbacks_given.toLocaleString()}
            valueStyle={{ fontSize: '2rem' }}
          />
        )}
        {tapbacks.total_tapbacks_received > 0 && (
          <StatCard 
            label="Tapbacks Received" 
            value={tapbacks.total_tapbacks_received.toLocaleString()}
            valueStyle={{ fontSize: '2rem' }}
          />
        )}
      </div>

      {orderedTapbacks.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <h3 style={{ textAlign: 'center', fontSize: '1.5rem', marginBottom: '1.5rem', opacity: 0.9 }}>
            Your Reactions
          </h3>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: '1rem',
            maxWidth: '1100px',
            margin: '0 auto'
          }}>
            {orderedTapbacks.map(type => (
              <div 
                key={type}
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: '12px',
                  padding: '1.5rem',
                  textAlign: 'center',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  transition: 'all 0.3s ease'
                }}
              >
                <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>
                  {TAPBACK_EMOJIS[type]}
                </div>
                <div style={{ fontSize: '0.9rem', opacity: 0.7, marginBottom: '0.25rem' }}>
                  {TAPBACK_LABELS[type]}
                </div>
                <div style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#a78bfa' }}>
                  {tapbackDistribution[type].toLocaleString()}
                </div>
              </div>
            ))}
          </div>

          {tapbackDistribution.like > 0 && tapbackDistribution.dislike > 0 && (
            <div style={{ 
              marginTop: '2rem',
              textAlign: 'center',
              background: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '16px',
              padding: '2rem',
              maxWidth: '400px',
              margin: '2rem auto 0',
              border: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
              <div style={{ fontSize: '0.9rem', opacity: 0.7, marginBottom: '0.75rem' }}>
                Like to Dislike Ratio
              </div>
              <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>
                👍 / 👎
              </div>
              <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#10b981' }}>
                {Math.round(tapbackDistribution.like / tapbackDistribution.dislike)}:1
              </div>
              <div style={{ fontSize: '0.85rem', opacity: 0.6, marginTop: '0.5rem' }}>
                {tapbackDistribution.like.toLocaleString()} likes vs {tapbackDistribution.dislike.toLocaleString()} dislikes
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

