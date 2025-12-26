import StatCard from './StatCard'

export default function TapbacksSection({ tapbacks }) {
  if (!tapbacks || (tapbacks.total_tapbacks_given === 0 && tapbacks.total_tapbacks_received === 0)) {
    return null
  }

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

      {tapbacks.favorite_tapback && tapbacks.favorite_tapback[0] && (
        <div style={{ marginTop: '2rem', textAlign: 'center' }}>
          <p style={{ opacity: 0.8 }}>Your Favorite Reaction</p>
          <p style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#ef4444' }}>
            {tapbacks.favorite_tapback[0]}
          </p>
          <p style={{ opacity: 0.7 }}>
            {tapbacks.favorite_tapback[1].toLocaleString()} times
          </p>
        </div>
      )}

      {tapbacks.most_received_tapback && tapbacks.most_received_tapback[0] && (
        <div style={{ marginTop: '2rem', textAlign: 'center' }}>
          <p style={{ opacity: 0.8 }}>Most Received Reaction</p>
          <p style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#ec4899' }}>
            {tapbacks.most_received_tapback[0]}
          </p>
          <p style={{ opacity: 0.7 }}>
            {tapbacks.most_received_tapback[1].toLocaleString()} times
          </p>
        </div>
      )}
    </div>
  )
}

