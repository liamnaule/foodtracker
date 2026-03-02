import { apiFetch } from './client'

export function listTransactions(params = {}) {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue
    qs.set(k, String(v))
  }
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  return apiFetch(`/api/transactions${suffix}`)
}

export function createTransaction(payload) {
  return apiFetch('/api/transactions', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function deleteTransaction(id) {
  return apiFetch(`/api/transactions/${id}`, { method: 'DELETE' })
}

