import StatCard from './StatCard'

export default function VolumeSection({ volume }) {
  if (!volume) return null

  return (
    <div className="section">
      <h2 className="section-title">📊 Activity Overview</h2>
      <div className="stats-grid">
        {volume.active_days && (
          <StatCard 
            label="Active Days" 
            value={volume.active_days.toLocaleString()}
            valueStyle={{ fontSize: '2rem' }}
          />
        )}
        {volume.most_sent_in_day && (
          <StatCard 
            label="Most Sent in One Day" 
            value={volume.most_sent_in_day.toLocaleString()}
            valueStyle={{ fontSize: '2rem' }}
          />
        )}
        {volume.most_received_in_day && (
          <StatCard 
            label="Most Received in One Day" 
            value={volume.most_received_in_day.toLocaleString()}
            valueStyle={{ fontSize: '2rem' }}
          />
        )}
      </div>
      {volume.busiest_day && (
        <div style={{ textAlign: 'center', marginTop: '2rem' }}>
          <p style={{ opacity: 0.8 }}>Your Busiest Day</p>
          <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>
            {volume.busiest_day.date}
          </p>
          <p style={{ fontSize: '3rem', fontWeight: 'bold', color: '#3b82f6' }}>
            {volume.busiest_day.total} messages
          </p>
        </div>
      )}
    </div>
  )
}

