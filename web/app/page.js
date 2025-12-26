export default function Home() {
  return (
    <main className="container">
      <div className="hero">
        <h1>
          iMessage <span className="gradient-text">Wrapped</span>
        </h1>
        <p style={{ fontSize: '1.5rem', marginBottom: '2rem', opacity: 0.8 }}>
          Your year in messages, beautifully visualized
        </p>
        <div style={{ 
          background: 'rgba(255,255,255,0.1)', 
          padding: '2rem', 
          borderRadius: '1rem',
          maxWidth: '600px'
        }}>
          <p style={{ marginBottom: '1rem' }}>To create your Wrapped:</p>
          <ol style={{ textAlign: 'left', lineHeight: '2' }}>
            <li>Install: <code style={{ background: 'rgba(0,0,0,0.3)', padding: '0.25rem 0.5rem', borderRadius: '0.25rem' }}>pip install imessage-wrapped</code></li>
            <li>Export: <code style={{ background: 'rgba(0,0,0,0.3)', padding: '0.25rem 0.5rem', borderRadius: '0.25rem' }}>imexport export --year 2025</code></li>
            <li>Share: <code style={{ background: 'rgba(0,0,0,0.3)', padding: '0.25rem 0.5rem', borderRadius: '0.25rem' }}>imessage-wrapped analyze exports/2025.jsonl --share</code></li>
          </ol>
        </div>
      </div>
    </main>
  )
}

