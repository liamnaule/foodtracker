import { apiFetch } from './client'

export function listPeople() {
  return apiFetch('/api/people')
}

export function createPerson(payload) {
  return apiFetch('/api/people', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function addPersonOrder(personId, payload) {
  return apiFetch(`/api/people/${personId}/orders`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function getPersonOrders(personId, { year, month }) {
  const qs = new URLSearchParams()
  if (year) qs.set('year', String(year))
  if (month) qs.set('month', String(month))
  return apiFetch(`/api/people/${personId}/orders?${qs.toString()}`)
}

export function getPersonMonthlySummary(personId, year) {
  return apiFetch(`/api/people/${personId}/summary/monthly?year=${encodeURIComponent(year)}`)
}

export function getPersonYearlySummary(personId) {
  return apiFetch(`/api/people/${personId}/summary/yearly`)
}

