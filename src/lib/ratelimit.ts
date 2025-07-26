// Simple in-memory rate limiter for production
const requests = new Map<string, { count: number; resetTime: number }>()

export function rateLimit(identifier: string, maxRequests = 60, windowMs = 60000): boolean {
  const now = Date.now()
  const windowStart = now - windowMs
  
  // Clean up old entries
  for (const [key, value] of requests.entries()) {
    if (value.resetTime < windowStart) {
      requests.delete(key)
    }
  }
  
  const userRequests = requests.get(identifier) || { count: 0, resetTime: now + windowMs }
  
  if (userRequests.resetTime < now) {
    // Reset window
    userRequests.count = 1
    userRequests.resetTime = now + windowMs
  } else {
    userRequests.count++
  }
  
  requests.set(identifier, userRequests)
  
  return userRequests.count <= maxRequests
}