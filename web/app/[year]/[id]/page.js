'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

export default function WrappedPage() {
  const params = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch(`/api/wrapped/${params.year}/${params.id}`)
        
        if (!response.ok) {
          throw new Error('Wrapped not found')
        }
        
        const json = await response.json()
        setData(json)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    
    fetchData()
  }, [params.year, params.id])

  if (loading) {
    return <div className="loading">Loading your Wrapped...</div>
  }

  if (error) {
    return (
      <div className="error">
        <h1>404</h1>
        <p>{error}</p>
        <p style={{ marginTop: '1rem', opacity: 0.6 }}>
          This Wrapped might have expired or the link is incorrect.
        </p>
      </div>
    )
  }

  const stats = data.statistics?.raw || data.statistics

  return (
    <main className="container">
      {/* Hero Section */}
      <div className="hero">
        <h1>
          Your <span className="gradient-text">{data.year}</span> in Messages
        </h1>
        
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Messages Sent</div>
            <div className="stat-value">
              {stats.volume?.total_sent?.toLocaleString() || 0}
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-label">Messages Received</div>
            <div className="stat-value" style={{ background: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              {stats.volume?.total_received?.toLocaleString() || 0}
            </div>
          </div>
        </div>
      </div>

      {/* Busiest Day */}
      {stats.volume?.busiest_day && (
        <div className="section">
          <h2 className="section-title">📊 Your Busiest Day</h2>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>
              {stats.volume.busiest_day.date}
            </p>
            <p style={{ fontSize: '3rem', fontWeight: 'bold', color: '#3b82f6' }}>
              {stats.volume.busiest_day.total} messages
            </p>
          </div>
        </div>
      )}

      {/* Top Contacts */}
      {stats.contacts?.top_sent_to && stats.contacts.top_sent_to.length > 0 && (
        <div className="section">
          <h2 className="section-title">👥 Your Top People</h2>
          <ul className="top-contacts">
            {stats.contacts.top_sent_to.slice(0, 5).map((contact, index) => (
              <li key={index}>
                <span>
                  <strong>#{index + 1}</strong> {contact.name}
                </span>
                <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#8b5cf6' }}>
                  {contact.count.toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Temporal Patterns */}
      {stats.temporal && (
        <div className="section">
          <h2 className="section-title">⏰ When You Text</h2>
          {stats.temporal.busiest_hour && (
            <div style={{ marginBottom: '2rem' }}>
              <p style={{ opacity: 0.8 }}>Busiest Hour:</p>
              <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#06b6d4' }}>
                {stats.temporal.busiest_hour[0]}:00 ({stats.temporal.busiest_hour[1]} messages)
              </p>
            </div>
          )}
          {stats.temporal.busiest_day_of_week && (
            <div>
              <p style={{ opacity: 0.8 }}>Busiest Day of Week:</p>
              <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#06b6d4' }}>
                {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][stats.temporal.busiest_day_of_week[0]]} ({stats.temporal.busiest_day_of_week[1]} messages)
              </p>
            </div>
          )}
        </div>
      )}

      {/* Emojis */}
      {stats.content?.most_used_emojis && stats.content.most_used_emojis.length > 0 && (
        <div className="section">
          <h2 className="section-title">😊 Your Favorite Emojis</h2>
          <div className="emoji-grid">
            {stats.content.most_used_emojis.slice(0, 5).map((emoji, index) => (
              <div key={index} className="emoji-item">
                <div className="emoji">{emoji.emoji}</div>
                <div className="count">{emoji.count}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Conversations */}
      {stats.conversations && (
        <div className="section">
          <h2 className="section-title">💬 Conversations</h2>
          <div className="stats-grid">
            {stats.conversations.total_conversations && (
              <div className="stat-card">
                <div className="stat-label">Total Conversations</div>
                <div className="stat-value" style={{ fontSize: '2rem' }}>
                  {stats.conversations.total_conversations}
                </div>
              </div>
            )}
            {stats.conversations.group_chats !== undefined && (
              <div className="stat-card">
                <div className="stat-label">Group Chats</div>
                <div className="stat-value" style={{ fontSize: '2rem' }}>
                  {stats.conversations.group_chats}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Streaks */}
      {stats.streaks?.longest_streak_days && (
        <div className="section">
          <h2 className="section-title">🔥 Your Longest Streak</h2>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '3rem', fontWeight: 'bold', color: '#f59e0b' }}>
              {stats.streaks.longest_streak_days} days
            </p>
            <p style={{ opacity: 0.8, marginTop: '1rem' }}>
              with {stats.streaks.longest_streak_contact}
            </p>
          </div>
        </div>
      )}

      <footer>
        <p>Views: {data.views}</p>
        <p style={{ marginTop: '1rem' }}>
          Create your own at <a href="/" style={{ color: '#8b5cf6' }}>imessage-wrapped</a>
        </p>
      </footer>
    </main>
  )
}

