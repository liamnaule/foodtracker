export function isoToday() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function currentYear() {
  return new Date().getFullYear()
}

export function monthLabel(yyyyMm) {
  const [y, m] = String(yyyyMm).split('-')
  const d = new Date(Number(y), Number(m) - 1, 1)
  return d.toLocaleString(undefined, { month: 'short' })
}

