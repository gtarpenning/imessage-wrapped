import { useEnhancement, PLAYFUL_INSTRUCTION } from '@/hooks/useEnhancement'

export default function EnhancedStat({ prompt, children, className = '' }) {
  const fullPrompt = prompt ? `${prompt} ${PLAYFUL_INSTRUCTION}` : null
  const { enhancement, loading } = useEnhancement(fullPrompt, !!fullPrompt)
    
  return (
    <div className={className}>
      {children}
      {enhancement && (
        <p style={{ 
          marginTop: '1.5rem',
          marginBottom: '1rem',
          fontSize: '1.5rem',
          fontWeight: '500',
          opacity: 0.85,
          fontStyle: 'italic',
          textAlign: 'center',
          lineHeight: '1.4'
        }}>
          {enhancement}
        </p>
      )}
      {loading && (
        <p style={{ 
          marginTop: '0.5rem', 
          fontSize: '0.8rem', 
          opacity: 0.5 
        }}>
          ✨
        </p>
      )}
    </div>
  )
}

