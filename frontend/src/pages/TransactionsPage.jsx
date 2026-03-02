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
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div>
            <p className="sectionTitle">Transactions</p>
            <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
              Add costs (ingredients, etc.) and revenue. The dashboard updates automatically.
            </div>
          </div>
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
        {error ? (
          <div style={{ marginTop: 10, color: 'var(--bad)', fontSize: 13 }}>{error}</div>
        ) : null}
      </div>

      <div className="card">
        <div className="cardTitle">Add</div>
        <form onSubmit={onCreate} className="formGrid">
          <div className="control col-3">
            <label>Date</label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
            />
          </div>
          <div className="control col-3">
            <label>Type</label>
            <select
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
            >
              <option value="expense">expense</option>
              <option value="revenue">revenue</option>
            </select>
          </div>
          <div className="control col-3">
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
          <div className="control col-3">
            <label>Amount</label>
            <input
              inputMode="decimal"
              placeholder="e.g. 500"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
            />
          </div>
          <div className="control col-9">
            <label>Note (optional)</label>
            <input
              placeholder="e.g. Costco run / 3 meals"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
          <button className="btn primary col-3" type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Add'}
          </button>
        </form>
      </div>

      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
          <p className="sectionTitle">History</p>
          <div className="controls">
            <div className="control">
              <label>Type</label>
              <select value={filters.type} onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}>
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

        <div className="list" style={{ marginTop: 10 }}>
          {items.map((t) => (
            <div key={t.id} className="listItem">
              <div className="muted listDate" style={{ fontSize: 12 }}>
                {t.date}
              </div>
              <div className="listMain">
                <div className="listTitle">
                  {t.category}{' '}
                  <span style={{ marginLeft: 6 }}>
                    <TypePill type={t.type} />
                  </span>
                </div>
                <div className="listSub">{t.description || '—'}</div>
              </div>
              <div className="listAmount" style={{ textAlign: 'right' }}>
                <div className={t.type === 'expense' ? 'amountNeg' : 'amountPos'}>
                  {t.type === 'expense' ? '-' : ''}
                  {formatMoneyFromCents(t.amount_cents)}
                </div>
                <button className="btn danger" style={{ marginTop: 8 }} onClick={() => onDelete(t.id)}>
                  Delete
                </button>
              </div>
            </div>
          ))}

          {!items.length ? (
            <div className="muted" style={{ fontSize: 13 }}>
              No transactions yet. Add your first ingredient cost or sale above.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

