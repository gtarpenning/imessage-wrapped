import StatCard from './StatCard'
import { useEnhancement, PLAYFUL_INSTRUCTION } from '@/hooks/useEnhancement'

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
        {content.questions_percentage !== undefined && (
          <StatCard 
            label="❓ Questions Asked" 
            value={`${content.questions_percentage}%`}
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

      <DoubleTextSection content={content} />

      <EmojiSection content={content} />
    </div>
  )
}

function DoubleTextSection({ content }) {
  const prompt = content.double_text_count !== undefined
    ? `You sent ${content.double_text_count} double texts, that's ${content.double_text_percentage}% of your messages. ${PLAYFUL_INSTRUCTION}`
    : null
  const { enhancement, loading } = useEnhancement(prompt, content.double_text_count !== undefined)
  const defaultTitle = 'Double Text Count'
  const title = enhancement || defaultTitle
  
  if (content.double_text_count === undefined) return null
  
  return (
    <div style={{ marginTop: '2rem', textAlign: 'center' }}>
      <p style={{ 
        fontSize: '1.5rem', 
        fontWeight: '500',
        marginBottom: '1rem',
        opacity: 0.85,
        fontStyle: enhancement ? 'italic' : 'normal'
      }}>
        {title}
      </p>
      <p style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#06b6d4' }}>
        {content.double_text_count.toLocaleString()}
      </p>
      {content.double_text_percentage !== undefined && (
        <p style={{ opacity: 0.7 }}>
          ({content.double_text_percentage}% of your messages)
        </p>
      )}
    </div>
  )
}

function EmojiSection({ content }) {
  const hasEmojis = content.most_used_emojis && content.most_used_emojis.length > 0
  const prompt = hasEmojis
    ? `Your favorite emoji was ${content.most_used_emojis[0].emoji} which you used ${content.most_used_emojis[0].count} times. ${PLAYFUL_INSTRUCTION}`
    : null
  const { enhancement, loading } = useEnhancement(prompt, hasEmojis)
  const defaultTitle = 'Most Used Emojis'
  const title = enhancement || defaultTitle
  
  if (!hasEmojis) return null
  
  return (
    <div style={{ marginTop: '2rem' }}>
      <h3 style={{ 
        fontSize: '1.5rem',
        fontWeight: '500',
        marginBottom: '1rem',
        opacity: 0.85,
        textAlign: 'center',
        fontStyle: enhancement ? 'italic' : 'normal'
      }}>
        {title}
      </h3>
      <div className="emoji-grid">
        {content.most_used_emojis.slice(0, 5).map((emoji, index) => (
          <div key={index} className="emoji-item">
            <div className="emoji">{emoji.emoji}</div>
            <div className="count">{emoji.count}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

