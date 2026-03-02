import { apiFetch } from './client'

export function getMonthlySummary(year) {
  return apiFetch(`/api/summary/monthly?year=${encodeURIComponent(year)}`)
}

export function getYearlySummary() {
  return apiFetch('/api/summary/yearly')
}

export function getCategorySummary({ year, month }) {
  const qs = new URLSearchParams()
  if (year) qs.set('year', String(year))
  if (month) qs.set('month', String(month))
  return apiFetch(`/api/summary/categories?${qs.toString()}`)
}

export function getProfitTrend(months = 24) {
  return apiFetch(`/api/analysis/profit-trend?months=${encodeURIComponent(months)}`)
}

