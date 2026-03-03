export function formatRent(amount: number): string {
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`
  if (amount >= 1000) return `₹${Math.round(amount / 1000)}k`
  return `₹${amount}`
}

export function formatAvailable(dateStr: string | null): string {
  if (!dateStr) return 'Available now'
  const date = new Date(dateStr)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  date.setHours(0, 0, 0, 0)
  if (date <= now) return 'Available now'
  return `From ${date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`
}

export function daysAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return '1d ago'
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months === 1) return '1mo ago'
  return `${months}mo ago`
}
