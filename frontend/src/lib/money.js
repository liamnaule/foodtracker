export function formatMoneyFromCents(cents, currency = 'KES') {
  const amount = (Number(cents || 0) / 100) || 0
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function parseDollarsToCents(input) {
  const raw = String(input ?? '').trim()
  if (!raw) return null
  const normalized = raw.replace(/,/g, '')
  const num = Number(normalized)
  if (!Number.isFinite(num) || num <= 0) return null
  return Math.round(num * 100)
}

