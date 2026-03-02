import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Pie,
  PieChart,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { getCategorySummary, getMonthlySummary, getProfitTrend } from '../api/summary'
import { currentYear, monthLabel } from '../lib/date'
import { formatMoneyFromCents } from '../lib/money'

function toneColor(tone) {
  if (tone === 'good') return 'var(--good)'
  if (tone === 'bad') return 'var(--bad)'
  if (tone === 'warn') return 'var(--warn)'
  return 'var(--text)'
}

function Kpi({ title, valueCents, hint, tone = 'good', compact = false }) {
  return (
    <div className="card">
      <div className="cardTitle">{title}</div>
      <div
        className={compact ? 'kpiValueSmall' : 'kpiValue'}
        style={{ color: toneColor(tone) }}
      >
        {formatMoneyFromCents(valueCents)}
      </div>
      {hint ? <div className="kpiHint">{hint}</div> : null}
    </div>
  )
}

function PercentKpi({ title, value, hint }) {
  const pct = Number.isFinite(value) ? value : 0
  const tone = pct >= 0.3 ? 'good' : pct >= 0.15 ? 'warn' : 'bad'
  const text = `${Math.round(pct * 100)}%`
  return (
    <div className="card">
      <div className="cardTitle">{title}</div>
      <div className="kpiValue" style={{ color: toneColor(tone) }}>
        {text}
      </div>
      {hint ? <div className="kpiHint">{hint}</div> : null}
    </div>
  )
}

const PIE_COLORS = [
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#06b6d4',
  '#3b82f6',
  '#6366f1',
  '#a855f7',
]

export function DashboardPage() {
  const [year, setYear] = useState(currentYear())
  const [selectedMonth, setSelectedMonth] = useState(null) // "01".."12"
  const [monthly, setMonthly] = useState(null)
  const [trend, setTrend] = useState(null)
  const [categories, setCategories] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let mounted = true
    async function run() {
      setLoading(true)
      setError(null)
      try {
        const [m, t] = await Promise.all([getMonthlySummary(year), getProfitTrend(24)])
        if (!mounted) return
        setMonthly(m)
        setTrend(t)

        const monthForCategories =
          selectedMonth || String(new Date().getMonth() + 1).padStart(2, '0')
        setSelectedMonth((prev) => prev || monthForCategories)
      } catch (e) {
        if (!mounted) return
        setError(e.message || 'Failed to load dashboard')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    run()
    return () => {
      mounted = false
    }
  }, [year])

  useEffect(() => {
    let mounted = true
    async function run() {
      if (!selectedMonth) return
      try {
        const c = await getCategorySummary({ year, month: selectedMonth })
        if (!mounted) return
        setCategories(c)
      } catch (e) {
        if (!mounted) return
        setError(e.message || 'Failed to load category summary')
      }
    }
    run()
    return () => {
      mounted = false
    }
  }, [year, selectedMonth])

  const monthOptions = useMemo(() => {
    const opts = []
    for (let i = 1; i <= 12; i++) {
      opts.push(String(i).padStart(2, '0'))
    }
    return opts
  }, [])

  const kpis = useMemo(() => {
    const totals = monthly?.totals || { revenue_cents: 0, expense_cents: 0, profit_cents: 0 }
    return {
      revenue: totals.revenue_cents,
      expense: totals.expense_cents,
      profit: totals.profit_cents,
    }
  }, [monthly])

  const profitIsLoss = kpis.profit < 0
  const profitLabel = profitIsLoss ? `Loss (${year})` : `Profit (${year})`
  const profitDisplayCents = Math.abs(kpis.profit)
  const margin = kpis.revenue > 0 ? kpis.profit / kpis.revenue : 0

  const monthlyChartData = useMemo(() => {
    if (!monthly?.months) return []
    return monthly.months.map((m) => ({
      month: monthLabel(m.month),
      Revenue: m.revenue_cents / 100,
      Expenses: m.expense_cents / 100,
      Profit: m.profit_cents / 100,
    }))
  }, [monthly])

  const trendData = useMemo(() => {
    if (!trend?.series) return []
    return trend.series.map((m) => ({
      month: m.month,
      Profit: m.profit_cents / 100,
    }))
  }, [trend])

  const categoryData = useMemo(() => {
    const items = categories?.items || []
    const sorted = [...items].sort((a, b) => (b.expense_cents || 0) - (a.expense_cents || 0))
    const top = sorted.slice(0, 6).map((x) => ({
      name: x.category,
      value: (x.expense_cents || 0) / 100,
    }))
    const other = sorted.slice(6).reduce((acc, x) => acc + (x.expense_cents || 0), 0) / 100
    if (other > 0) top.push({ name: 'Other', value: other })
    return top.filter((x) => x.value > 0)
  }, [categories])

  const profitLossPie = useMemo(() => {
    const series = trend?.series || []
    let profitCents = 0
    let lossCents = 0
    for (const m of series) {
      const p = Number(m.profit_cents || 0)
      if (p >= 0) profitCents += p
      else lossCents += Math.abs(p)
    }
    const data = []
    if (profitCents > 0) data.push({ name: 'Profit', value: profitCents / 100 })
    if (lossCents > 0) data.push({ name: 'Loss', value: lossCents / 100 })
    if (!data.length) data.push({ name: 'No data', value: 1 })
    return data
  }, [trend])

  return (
    <div className="pageGrid">
      <div className="grid" style={{ gap: 12 }}>
        <div className="card">
          <p className="sectionTitle">Dashboard</p>
          <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
            Track spending (ingredients, etc.) and see monthly/yearly profit &amp; loss.
          </div>
          <div className="divider" />
          <div className="controls">
            <div className="control">
              <label>Year</label>
              <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
                {Array.from({ length: 7 }).map((_, i) => {
                  const y = currentYear() - 5 + i
                  return (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  )
                })}
              </select>
            </div>
            <div className="control">
              <label>Categories month</label>
              <select value={selectedMonth || ''} onChange={(e) => setSelectedMonth(e.target.value)}>
                {monthOptions.map((mm) => (
                  <option key={mm} value={mm}>
                    {mm}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {error ? (
            <div style={{ marginTop: 10, color: 'var(--bad)', fontSize: 13 }}>{error}</div>
          ) : null}
          {loading ? (
            <div style={{ marginTop: 10 }} className="muted">
              Loading…
            </div>
          ) : null}
        </div>

        <div className="grid kpis">
          <Kpi
            title={`Revenue (${year})`}
            valueCents={kpis.revenue}
            hint="Money earned"
            tone="good"
          />
          <Kpi
            title={`Expenses (${year})`}
            valueCents={kpis.expense}
            hint="Money spent"
            tone="bad"
          />
          <Kpi
            title={profitLabel}
            valueCents={profitDisplayCents}
            hint={profitIsLoss ? 'Expenses exceeded revenue' : 'Revenue − expenses'}
            tone={profitIsLoss ? 'bad' : 'good'}
          />
          <PercentKpi title="Margin" value={margin} hint="Profit ÷ revenue" />
        </div>
      </div>

      <div className="grid" style={{ gap: 12 }}>
        <div className="card">
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
            <p className="sectionTitle">Monthly profit &amp; loss</p>
            <div className="muted" style={{ fontSize: 12 }}>
              Tooltip shows KES.
            </div>
          </div>
          <div style={{ width: '100%', height: 340, marginTop: 8 }}>
            <ResponsiveContainer>
              <BarChart data={monthlyChartData}>
                <CartesianGrid stroke="rgba(226, 232, 240, 0.95)" />
                <XAxis dataKey="month" tick={{ fill: 'rgba(15, 23, 42, 0.75)' }} />
                <YAxis tick={{ fill: 'rgba(15, 23, 42, 0.75)' }} />
                <Tooltip
                  formatter={(val) => formatMoneyFromCents(Math.round(Number(val) * 100))}
                  contentStyle={{
                    background: '#ffffff',
                    border: '1px solid rgba(226, 232, 240, 1)',
                    borderRadius: 12,
                    color: 'rgba(15, 23, 42, 0.92)',
                    boxShadow: '0 8px 24px rgba(15, 23, 42, 0.10)',
                  }}
                />
                <Legend />
                <Bar dataKey="Revenue" fill="rgba(22, 163, 74, 0.75)" radius={[8, 8, 0, 0]} />
                <Bar dataKey="Expenses" fill="rgba(220, 38, 38, 0.62)" radius={[8, 8, 0, 0]} />
                <Bar dataKey="Profit" fill="rgba(79, 70, 229, 0.62)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>
            Tip: log ingredient costs as “expense → ingredients”.
          </div>
        </div>

        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="card">
            <p className="sectionTitle">Top spending categories</p>
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
              {year}-{selectedMonth} (expenses only)
            </div>
            <div style={{ width: '100%', height: 280, marginTop: 10 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Tooltip
                    formatter={(val) => formatMoneyFromCents(Math.round(Number(val) * 100))}
                    contentStyle={{
                      background: '#ffffff',
                      border: '1px solid rgba(226, 232, 240, 1)',
                      borderRadius: 12,
                      color: 'rgba(15, 23, 42, 0.92)',
                      boxShadow: '0 8px 24px rgba(15, 23, 42, 0.10)',
                    }}
                  />
                  <Legend />
                  <Pie
                    data={categoryData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={2}
                    labelLine={false}
                    label={({ name }) => name}
                  >
                    {categoryData.map((_, idx) => (
                      <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            {!categoryData.length ? (
              <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
                No spending logged for that month yet.
              </div>
            ) : null}
          </div>

          <div className="card">
            <p className="sectionTitle">Profit vs loss</p>
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
              Last 24 months (pie makes loss obvious)
            </div>
            <div style={{ width: '100%', height: 280, marginTop: 10 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Tooltip
                    formatter={(val) => formatMoneyFromCents(Math.round(Number(val) * 100))}
                    contentStyle={{
                      background: '#ffffff',
                      border: '1px solid rgba(226, 232, 240, 1)',
                      borderRadius: 12,
                      color: 'rgba(15, 23, 42, 0.92)',
                      boxShadow: '0 8px 24px rgba(15, 23, 42, 0.10)',
                    }}
                  />
                  <Legend />
                  <Pie
                    data={profitLossPie}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={2}
                    labelLine={false}
                    label={({ name }) => name}
                  >
                    {profitLossPie.map((entry, idx) => (
                      <Cell
                        key={idx}
                        fill={entry.name === 'Loss' ? 'rgba(220, 38, 38, 0.70)' : 'rgba(22, 163, 74, 0.70)'}
                      />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

