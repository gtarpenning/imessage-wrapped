'use client'

export default function Home() {
  return (
    <main className="container">
      <div className="hero">
        <h1>
          iMessage <span className="gradient-text">Wrapped</span>
        </h1>
        <p style={{ fontSize: '1.5rem', marginBottom: '2rem', opacity: 0.8 }}>
          Your year in messages, visualized
        </p>
        
        <div style={{ 
          display: 'flex', 
          gap: '1rem', 
          marginBottom: '2rem',
          flexWrap: 'wrap',
          justifyContent: 'center'
        }}>
          <a
            href="/api/download"
            style={{
              background: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)',
              color: 'white',
              padding: '1rem 2rem',
              borderRadius: '0.75rem',
              textDecoration: 'none',
              fontWeight: '600',
              fontSize: '1.1rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'transform 0.2s',
            }}
            onMouseEnter={(e) => e.target.style.transform = 'scale(1.05)'}
            onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
          >
            🖥️ Download for macOS
          </a>
        </div>

        <div style={{ 
          background: 'rgba(255,255,255,0.1)', 
          padding: '2rem', 
          borderRadius: '1rem',
          maxWidth: '600px'
        }}>
          <p style={{ marginBottom: '1rem', opacity: 0.8, textAlign: 'center' }}>
            Or use the command line:
          </p>
          <pre style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '0.5rem', textAlign: 'left', maxWidth: '500px', margin: '0 auto', overflow: 'auto' }}>
            <code>pip install imessage-wrapped{'\n'}imexport analyze</code>
          </pre>
          <p style={{ marginTop: '1.5rem', opacity: 0.7, textAlign: 'center' }}>
            <a 
              href="https://github.com/gtarpenning/imessage-wrapped" 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ color: '#8b5cf6', textDecoration: 'none' }}
            >
              View on GitHub →
            </a>
          </p>
        </div>
      </div>
    </main>
  )
}

