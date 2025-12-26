// Privacy utilities - sanitize data before upload
import crypto from 'crypto'

// Anonymize a contact identifier (phone/email)
export function anonymizeIdentifier(identifier) {
  if (!identifier || identifier === 'unknown') {
    return 'unknown'
  }
  
  // Determine type
  const prefix = identifier.includes('@') ? 'email' : 'phone'
  
  // One-way hash
  const hash = crypto
    .createHash('sha256')
    .update(identifier)
    .digest('hex')
    .substring(0, 12)
  
  return `${prefix}_${hash}`
}

// Recursively scan and remove any remaining PII
function scanObject(obj) {
  if (typeof obj !== 'object' || obj === null) {
    return obj
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => scanObject(item))
  }
  
  const cleaned = {}
  for (const [key, value] of Object.entries(obj)) {
    // Skip any keys that might contain PII
    if (key === 'name' || key === 'display_name') {
      cleaned[key] = null
    } else if (key === 'identifier' && typeof value === 'string') {
      // Anonymize identifiers
      cleaned[key] = anonymizeIdentifier(value)
    } else {
      cleaned[key] = scanObject(value)
    }
  }
  
  return cleaned
}

// Main sanitization function - removes ALL PII before upload
export function sanitizeStatistics(statistics) {
  const clean = JSON.parse(JSON.stringify(statistics)) // Deep clone
  
  // Remove any sample messages or text content
  const forbiddenKeys = ['sample_messages', 'message_text', 'content_samples', 'text']
  
  function removeForbiddenKeys(obj) {
    if (typeof obj !== 'object' || obj === null) return
    
    for (const key of forbiddenKeys) {
      delete obj[key]
    }
    
    for (const value of Object.values(obj)) {
      if (typeof value === 'object') {
        removeForbiddenKeys(value)
      }
    }
  }
  
  removeForbiddenKeys(clean)
  
  // Scan and anonymize all identifiers
  return scanObject(clean)
}

