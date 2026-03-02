import { useEffect, useMemo, useState } from 'react'
import { createTransaction, deleteTransaction, listTransactions } from '../api/transactions'
import { isoToday } from '../lib/date'
import { formatMoneyFromCents, parseDollarsToCents } from '../lib/money'

const COMMON_CATEGORIES = [
  'ingredients',
  'packaging',
  'utilities',
  'equipment',
  'labor',
  'rent',
  'transport',
  'marketing',
  'other',
]

function TypePill({ type }) {
  return <span className={`pill ${type}`}>{type}</span>
}

export function TransactionsPage() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const [filters, setFilters] = useState({
    type: '',
    search: '',
    limit: 100,
  })

  const [form, setForm] = useState({
    date: isoToday(),
    type: 'expense',
    category: 'ingredients',
    description: '',
    amount: '',
  })
  const [saving, setSaving] = useState(false)

  async function refresh() {
    setLoading(true)
    setError(null)
    try {
      const res = await listTransactions(filters)
      setItems(res.items || [])
    } catch (e) {
      setError(e.message || 'Failed to load transactions')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.type, filters.search, filters.limit])

  const totals = useMemo(() => {
    let revenue = 0
    let expense = 0
    for (const t of items) {
      if (t.type === 'revenue') revenue += t.amount_cents
      if (t.type === 'expense') expense += t.amount_cents
    }
    return { revenue, expense, profit: revenue - expense }
  }, [items])

  const profitIsLoss = totals.profit < 0

  async function onCreate(e) {
    e.preventDefault()
    setError(null)
    const amount_cents = parseDollarsToCents(form.amount)
    if (!amount_cents) {
      setError('Enter a valid amount (e.g. 12.50)')
      return
    }
    if (!form.category?.trim()) {
      setError('Category is required (e.g. ingredients)')
      return
    }
    setSaving(true)
    try {
      await createTransaction({
        date: form.date,
        type: form.type,
        category: form.category.trim(),
        description: form.description || '',
        amount_cents,
      })
      setForm((f) => ({ ...f, description: '', amount: '' }))
      await refresh()
    } catch (e2) {
      setError(e2.message || 'Failed to save transaction')
    } finally {
      setSaving(false)
    }
  }

  async function onDelete(id) {
    const ok = confirm('Delete this transaction?')
    if (!ok) return
    setError(null)
    try {
      await deleteTransaction(id)
      await refresh()
    } catch (e) {
      setError(e.message || 'Failed to delete')
    }
  }

  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="card">
        <div style={{ fontSize: 18, fontWeight: 800 }}>Transactions</div>
        <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
          Add your revenue and your costs (ingredients, etc.). Everything here powers the dashboard.
        </div>
        {error ? (
          <div style={{ marginTop: 10, color: 'var(--bad)', fontSize: 13 }}>{error}</div>
        ) : null}
      </div>

      <div className="card">
        <div className="cardTitle">Quick totals (current list)</div>
        <div className="row" style={{ gap: 14 }}>
          <div>
            <div className="muted" style={{ fontSize: 12 }}>
              Revenue
            </div>
            <div style={{ fontWeight: 800, color: 'var(--good)' }}>
              {formatMoneyFromCents(totals.revenue)}
            </div>
          </div>
          <div>
            <div className="muted" style={{ fontSize: 12 }}>
              Expenses
            </div>
            <div style={{ fontWeight: 800, color: 'var(--bad)' }}>
              {formatMoneyFromCents(totals.expense)}
            </div>
          </div>
          <div>
            <div className="muted" style={{ fontSize: 12 }}>
              {profitIsLoss ? 'Loss' : 'Profit'}
            </div>
            <div style={{ fontWeight: 800, color: totals.profit >= 0 ? 'var(--good)' : 'var(--bad)' }}>
              {formatMoneyFromCents(Math.abs(totals.profit))}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="cardTitle">Add a transaction</div>
        <form onSubmit={onCreate} className="row" style={{ alignItems: 'flex-end' }}>
          <div className="control">
            <label>Date</label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
            />
          </div>
          <div className="control">
            <label>Type</label>
            <select
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
            >
              <option value="expense">expense</option>
              <option value="revenue">revenue</option>
            </select>
          </div>
          <div className="control">
            <label>Category</label>
            <input
              list="categories"
              placeholder="ingredients"
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            />
            <datalist id="categories">
              {COMMON_CATEGORIES.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div className="control" style={{ minWidth: 260, flex: 1 }}>
            <label>Description</label>
            <input
              placeholder="e.g. Costco run"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div className="control">
            <label>Amount</label>
            <input
              inputMode="decimal"
              placeholder="12.50"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
            />
          </div>
          <button className="btn primary" type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Add'}
          </button>
        </form>
      </div>

      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800 }}>Recent transactions</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 3 }}>
              Use search to find “ingredients”, “sales”, etc.
            </div>
          </div>
          <div className="controls">
            <div className="control">
              <label>Type</label>
              <select
                value={filters.type}
                onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}
              >
                <option value="">all</option>
                <option value="expense">expense</option>
                <option value="revenue">revenue</option>
              </select>
            </div>
            <div className="control">
              <label>Search</label>
              <input
                placeholder="ingredients…"
                value={filters.search}
                onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
              />
            </div>
            <button className="btn" onClick={refresh} disabled={loading}>
              {loading ? 'Loading…' : 'Refresh'}
            </button>
          </div>
        </div>

        <div style={{ overflowX: 'auto', marginTop: 10 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Category</th>
                <th>Description</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((t) => (
                <tr key={t.id}>
                  <td>{t.date}</td>
                  <td>
                    <TypePill type={t.type} />
                  </td>
                  <td>{t.category}</td>
                  <td className="muted">{t.description}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>
                    {t.type === 'expense' ? (
                      <span style={{ color: 'var(--bad)' }}>-{formatMoneyFromCents(t.amount_cents)}</span>
                    ) : (
                      <span style={{ color: 'var(--good)' }}>{formatMoneyFromCents(t.amount_cents)}</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn danger" onClick={() => onDelete(t.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {!items.length ? (
                <tr>
                  <td colSpan={6} className="muted">
                    No transactions yet. Add your first ingredient cost or sale above.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

