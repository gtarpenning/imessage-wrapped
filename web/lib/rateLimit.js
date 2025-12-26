// Simple in-memory rate limiter
const uploadAttempts = new Map()

// Clean up old entries every 10 minutes
setInterval(() => {
  const now = Date.now()
  for (const [ip, data] of uploadAttempts.entries()) {
    if (now - data.resetAt > 0) {
      uploadAttempts.delete(ip)
    }
  }
}, 10 * 60 * 1000)

export function checkRateLimit(ip) {
  const now = Date.now()
  const data = uploadAttempts.get(ip)
  
  if (!data || now > data.resetAt) {
    // First request or expired window
    uploadAttempts.set(ip, {
      count: 1,
      resetAt: now + (60 * 60 * 1000) // 1 hour
    })
    return { allowed: true, remaining: 4 }
  }
  
  if (data.count >= 5) {
    // Rate limit exceeded
    return { allowed: false, remaining: 0 }
  }
  
  // Increment counter
  data.count += 1
  return { allowed: true, remaining: 5 - data.count }
}

