import { useEffect, useMemo, useState } from 'react'
import {
  addPersonOrder,
  createPerson,
  getPersonMonthlySummary,
  getPersonOrders,
  getPersonYearlySummary,
  listPeople,
} from '../api/people'
import { isoToday } from '../lib/date'
import { formatMoneyFromCents, parseDollarsToCents } from '../lib/money'

export function PeoplePage() {
  const [people, setPeople] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [orders, setOrders] = useState([])
  const [monthlySummary, setMonthlySummary] = useState(null)
  const [yearlySummary, setYearlySummary] = useState(null)
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState(String(new Date().getMonth() + 1).padStart(2, '0'))
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const [personForm, setPersonForm] = useState({ name: '' })
  const [orderForm, setOrderForm] = useState({ date: isoToday(), cost: '' })

  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        const res = await listPeople()
        if (!mounted) return
        setPeople(res.items || [])
        if (!selectedId && res.items?.length) {
          setSelectedId(res.items[0].id)
        }
      } catch (e) {
        if (!mounted) return
        setError(e.message || 'Failed to load people')
      }
    }
    load()
    return () => {
      mounted = false
    }
  }, [selectedId])

  useEffect(() => {
    if (!selectedId) return
    let mounted = true
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [ordersRes, monthlyRes, yearlyRes] = await Promise.all([
          getPersonOrders(selectedId, { year, month }),
          getPersonMonthlySummary(selectedId, year),
          getPersonYearlySummary(selectedId),
        ])
        if (!mounted) return
        setOrders(ordersRes.items || [])
        setMonthlySummary(monthlyRes)
        setYearlySummary(yearlyRes)
      } catch (e) {
        if (!mounted) return
        setError(e.message || 'Failed to load orders')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => {
      mounted = false
    }
  }, [selectedId, year, month])

  const activePerson = useMemo(
    () => people.find((p) => p.id === selectedId) || null,
    [people, selectedId],
  )

  const monthTotals = monthlySummary?.items || []
  const yearTotals = yearlySummary?.items || []

  const thisYearTotalCents = useMemo(
    () => (monthTotals || []).reduce((acc, m) => acc + (m.total_cents || 0), 0),
    [monthTotals],
  )

  const allTimeTotalCents = useMemo(
    () => (yearTotals || []).reduce((acc, y) => acc + (y.total_cents || 0), 0),
    [yearTotals],
  )

  async function onCreatePerson(e) {
    e.preventDefault()
    setError(null)
    const name = personForm.name.trim()
    if (!name) {
      setError('Name is required')
      return
    }
    setSaving(true)
    try {
      const created = await createPerson({ name })
      setPeople((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
      setPersonForm({ name: '' })
      setSelectedId(created.id)
    } catch (e2) {
      setError(e2.message || 'Failed to add person')
    } finally {
      setSaving(false)
    }
  }

  async function onAddOrder(e) {
    e.preventDefault()
    if (!selectedId) return
    setError(null)
    const cost_cents = parseDollarsToCents(orderForm.cost)
    if (!cost_cents) {
      setError('Enter a valid cost per day (e.g. 500)')
      return
    }
    setSaving(true)
    try {
      await addPersonOrder(selectedId, {
        date: orderForm.date,
        cost_cents,
      })
      setOrderForm((f) => ({ ...f, cost: '' }))
      const refreshed = await getPersonOrders(selectedId, { year, month })
      setOrders(refreshed.items || [])
      const monthlyRes = await getPersonMonthlySummary(selectedId, year)
      const yearlyRes = await getPersonYearlySummary(selectedId)
      setMonthlySummary(monthlyRes)
      setYearlySummary(yearlyRes)
    } catch (e2) {
      setError(e2.message || 'Failed to add order')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div>
            <p className="sectionTitle">People</p>
            <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
              Pick a person, add the day they ordered, and the daily cost.
            </div>
          </div>
          <div className="controls">
            <div className="control">
              <label>Person</label>
              <select
                value={selectedId || ''}
                onChange={(e) => setSelectedId(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">Select…</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="control">
              <label>Year</label>
              <input
                type="number"
                style={{ width: 90 }}
                value={year}
                onChange={(e) => setYear(Number(e.target.value || new Date().getFullYear()))}
              />
            </div>
            <div className="control">
              <label>Month</label>
              <select value={month} onChange={(e) => setMonth(e.target.value)}>
                {Array.from({ length: 12 }).map((_, i) => {
                  const m = String(i + 1).padStart(2, '0')
                  return (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  )
                })}
              </select>
            </div>
          </div>
        </div>
        {error ? (
          <div style={{ marginTop: 10, color: 'var(--bad)', fontSize: 13 }}>{error}</div>
        ) : null}
      </div>

      <div className="grid peopleLayout">
        <div className="card">
          <div className="cardTitle">Add person</div>
          <form onSubmit={onCreatePerson} className="formGrid">
            <div className="control col-9">
              <label>Name</label>
              <input
                placeholder="e.g. John"
                value={personForm.name}
                onChange={(e) => setPersonForm({ name: e.target.value })}
              />
            </div>
            <button className="btn primary col-3" type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Add'}
            </button>
          </form>
          <div className="divider" />
          <div className="muted" style={{ fontSize: 12 }}>
            People added: {people.length}
          </div>
        </div>

        <div className="grid" style={{ gap: 12 }}>
          <div className="card">
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div>
                <p className="sectionTitle">
                  {activePerson ? activePerson.name : 'No person selected'}
                </p>
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                  Cost per day and totals in KES.
                </div>
              </div>
            </div>
            {loading ? (
              <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
                Loading…
              </div>
            ) : null}
            <div className="divider" />
            <div className="grid kpis">
              <div className="card">
                <div className="cardTitle">Month total</div>
                <div className="kpiValueSmall">
                  {formatMoneyFromCents(monthlySummary?.totals?.total_cents || 0)}
                </div>
                <div className="kpiHint">
                  {monthlySummary?.totals?.days || 0} days in {year}-{month}
                </div>
              </div>
              <div className="card">
                <div className="cardTitle">Year total</div>
                <div className="kpiValueSmall">{formatMoneyFromCents(thisYearTotalCents)}</div>
                <div className="kpiHint">{year}</div>
              </div>
              <div className="card">
                <div className="cardTitle">All-time total</div>
                <div className="kpiValueSmall">{formatMoneyFromCents(allTimeTotalCents)}</div>
                <div className="kpiHint">All years</div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="cardTitle">Add day ordered</div>
            <form onSubmit={onAddOrder} className="formGrid">
              <div className="control col-4">
                <label>Date</label>
                <input
                  type="date"
                  value={orderForm.date}
                  onChange={(e) => setOrderForm((f) => ({ ...f, date: e.target.value }))}
                />
              </div>
              <div className="control col-4">
                <label>Cost per day</label>
                <input
                  inputMode="decimal"
                  placeholder="e.g. 500"
                  value={orderForm.cost}
                  onChange={(e) => setOrderForm((f) => ({ ...f, cost: e.target.value }))}
                />
              </div>
              <button className="btn primary col-4" type="submit" disabled={saving || !selectedId}>
                {saving ? 'Saving…' : 'Add'}
              </button>
            </form>
          </div>

          <div className="card">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div>
                <p className="sectionTitle">This month</p>
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                  {year}-{month} days ordered.
                </div>
              </div>
            </div>
            <div className="list" style={{ marginTop: 10, maxHeight: 300, overflowY: 'auto' }}>
              {orders.map((o) => (
                <div key={o.id} className="listItem">
                  <div className="muted listDate" style={{ fontSize: 12 }}>
                    {o.date}
                  </div>
                  <div className="listMain">
                    <div className="listTitle">Ordered</div>
                    <div className="listSub">Cost per day</div>
                  </div>
                  <div className="listAmount amountNeg">
                    {formatMoneyFromCents(o.cost_cents)}
                  </div>
                </div>
              ))}
              {!orders.length ? (
                <div className="muted" style={{ fontSize: 13 }}>
                  No days logged yet for this month.
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

