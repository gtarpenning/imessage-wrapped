import { useState, useEffect, useMemo } from 'react'

export const PLAYFUL_INSTRUCTION = 'Write a short, witty, playful one-liner about this in under 10 words. Its a header for a section with the stat.'

let sessionId = null

function getSessionId() {
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
  return sessionId
}

export function useEnhancement(prompt, enabled = true) {
  const [enhancement, setEnhancement] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  
  const memoizedPrompt = useMemo(() => prompt, [prompt])
  
  useEffect(() => {
    if (!enabled || !memoizedPrompt) {
      setLoading(false)
      return
    }
    
    let cancelled = false
    
    async function fetchEnhancement() {
      setLoading(true)
      setError(null)
      
      try {
        const response = await fetch('/api/llm/enhance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: memoizedPrompt,
            sessionId: getSessionId()
          })
        })
        
        if (!response.ok) {
          const data = await response.json()
          if (response.status === 429) {
            console.log('Enhancement limit reached')
            return
          }
          throw new Error(data.error || 'Failed to fetch enhancement')
        }
        
        const data = await response.json()
        
        if (!cancelled) {
          setEnhancement(data.enhancement || '')
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message)
          console.error('Enhancement error:', err)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }
    
    fetchEnhancement()
    
    return () => {
      cancelled = true
    }
  }, [memoizedPrompt, enabled])
  
  return { enhancement, loading, error }
}

