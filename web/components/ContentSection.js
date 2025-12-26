import StatCard from './StatCard'

export default function ContentSection({ content }) {
  if (!content) return null

  return (
    <div className="section">
      <h2 className="section-title">💬 Message Content</h2>
      
      <div className="stats-grid">
        {content.avg_message_length_sent !== undefined && (
          <StatCard 
            label="Avg Message Length (Sent)" 
            value={`${Math.round(content.avg_message_length_sent)} chars`}
            valueStyle={{ fontSize: '2rem' }}
          />
        )}
        {content.avg_message_length_received !== undefined && (
          <StatCard 
            label="Avg Message Length (Received)" 
            value={`${Math.round(content.avg_message_length_received)} chars`}
            valueStyle={{ fontSize: '2rem' }}
          />
        )}
        {content.questions_asked !== undefined && (
          <StatCard 
            label="❓ Questions Asked" 
            value={content.questions_asked.toLocaleString()}
            valueStyle={{ fontSize: '2rem' }}
          />
        )}
        {content.enthusiasm_percentage !== undefined && (
          <StatCard 
            label="❗ Enthusiasm Level" 
            value={`${content.enthusiasm_percentage}%`}
            valueStyle={{ fontSize: '2rem' }}
          />
        )}
        {content.attachments_sent !== undefined && (
          <StatCard 
            label="📎 Attachments Sent" 
            value={content.attachments_sent.toLocaleString()}
            valueStyle={{ fontSize: '2rem' }}
          />
        )}
        {content.attachments_received !== undefined && (
          <StatCard 
            label="📎 Attachments Received" 
            value={content.attachments_received.toLocaleString()}
            valueStyle={{ fontSize: '2rem' }}
          />
        )}
      </div>

      {content.double_text_count !== undefined && (
        <div style={{ marginTop: '2rem', textAlign: 'center' }}>
          <p style={{ opacity: 0.8 }}>Double Text Count</p>
          <p style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#06b6d4' }}>
            {content.double_text_count.toLocaleString()}
          </p>
          {content.double_text_percentage !== undefined && (
            <p style={{ opacity: 0.7 }}>
              ({content.double_text_percentage}% of your messages)
            </p>
          )}
        </div>
      )}

      {content.most_used_emojis && content.most_used_emojis.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem', opacity: 0.8, textAlign: 'center' }}>Most Used Emojis</h3>
          <div className="emoji-grid">
            {content.most_used_emojis.slice(0, 5).map((emoji, index) => (
              <div key={index} className="emoji-item">
                <div className="emoji">{emoji.emoji}</div>
                <div className="count">{emoji.count}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

