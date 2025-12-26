export default function WrappedFooter({ views }) {
  return (
    <footer>
      <p>Views: {views}</p>
      <p style={{ marginTop: '1rem' }}>
        Create your own at <a href="/" style={{ color: '#8b5cf6' }}>imessage-wrapped</a>
      </p>
    </footer>
  )
}

