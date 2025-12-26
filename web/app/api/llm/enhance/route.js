import { NextResponse } from 'next/server'
import { getCompletion } from '@/lib/llm'

const MAX_ENHANCEMENTS_PER_SESSION = 50
const sessionCounts = new Map()

function cleanupOldSessions() {
  const now = Date.now()
  const FIVE_MINUTES = 5 * 60 * 1000
  
  for (const [sessionId, data] of sessionCounts.entries()) {
    if (now - data.createdAt > FIVE_MINUTES) {
      sessionCounts.delete(sessionId)
    }
  }
}

function checkSessionLimit(sessionId) {
  cleanupOldSessions()
  
  const data = sessionCounts.get(sessionId)
  
  if (!data) {
    sessionCounts.set(sessionId, { count: 1, createdAt: Date.now() })
    return { allowed: true, remaining: MAX_ENHANCEMENTS_PER_SESSION - 1 }
  }
  
  if (data.count >= MAX_ENHANCEMENTS_PER_SESSION) {
    return { allowed: false, remaining: 0 }
  }
  
  data.count += 1
  return { allowed: true, remaining: MAX_ENHANCEMENTS_PER_SESSION - data.count }
}

export async function POST(request) {
  try {
    const { prompt, sessionId } = await request.json()
    
    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      )
    }
    
    if (!sessionId || typeof sessionId !== 'string') {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      )
    }
    
    const limit = checkSessionLimit(sessionId)
    
    if (!limit.allowed) {
      return NextResponse.json(
        { error: 'Maximum enhancements reached for this page view' },
        { status: 429 }
      )
    }
    
    const result = await getCompletion(prompt)
    
    return NextResponse.json({
      enhancement: result.completion,
      cached: result.cached,
      remaining: limit.remaining
    })
    
  } catch (error) {
    console.error('LLM enhancement error:', error)
    
    return NextResponse.json(
      { error: 'Failed to generate enhancement', fallback: '' },
      { status: 500 }
    )
  }
}

