import express from "express";
import cors from "cors";
import { openDb } from "./db.js";
import {
  PersonOrderSchema,
  PersonSchema,
  TransactionPatchSchema,
  TransactionSchema,
  TransactionType,
} from "./validation.js";

const PORT = Number(process.env.PORT || 3001);
const app = express();
const db = openDb();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

function asIsoDate(value) {
  if (typeof value !== "string") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return value;
}

function monthKeyFromIsoDate(isoDate) {
  // isoDate is YYYY-MM-DD
  return isoDate.slice(0, 7);
}

function rowsToMonthlySeries(rows, year) {
  const byMonth = new Map();
  for (let m = 1; m <= 12; m++) {
    const mm = String(m).padStart(2, "0");
    byMonth.set(`${year}-${mm}`, { revenue_cents: 0, expense_cents: 0 });
  }
  for (const r of rows) {
    const key = r.month;
    if (!byMonth.has(key)) continue;
    const rec = byMonth.get(key);
    if (r.type === "revenue") rec.revenue_cents += r.total_cents;
    if (r.type === "expense") rec.expense_cents += r.total_cents;
  }
  return Array.from(byMonth.entries()).map(([month, v]) => ({
    month,
    revenue_cents: v.revenue_cents,
    expense_cents: v.expense_cents,
    profit_cents: v.revenue_cents - v.expense_cents,
  }));
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/transactions", (req, res) => {
  const start = asIsoDate(req.query.start);
  const end = asIsoDate(req.query.end);
  const type = req.query.type ? TransactionType.safeParse(req.query.type) : null;
  const category =
    typeof req.query.category === "string" ? req.query.category.trim() : null;
  const search =
    typeof req.query.search === "string" ? req.query.search.trim() : null;

  const limitRaw = Number(req.query.limit ?? 100);
  const offsetRaw = Number(req.query.offset ?? 0);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(500, limitRaw)) : 100;
  const offset = Number.isFinite(offsetRaw) ? Math.max(0, offsetRaw) : 0;

  const where = [];
  const params = {};

  if (start) {
    where.push("date >= @start");
    params.start = start;
  }
  if (end) {
    where.push("date <= @end");
    params.end = end;
  }
  if (type?.success) {
    where.push("type = @type");
    params.type = type.data;
  }
  if (category) {
    where.push("category = @category");
    params.category = category;
  }
  if (search) {
    where.push("(description LIKE @q OR category LIKE @q)");
    params.q = `%${search}%`;
  }

  const sql = `
    SELECT id, date, type, category, description, amount_cents, created_at
    FROM transactions
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY date DESC, id DESC
    LIMIT @limit OFFSET @offset
  `;

  const rows = db.prepare(sql).all({ ...params, limit, offset });
  res.json({ items: rows, limit, offset });
});

app.post("/api/transactions", (req, res) => {
  const parsed = TransactionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
  }
  const { date, type, category, description, amount_cents } = parsed.data;
  const info = db
    .prepare(
      `
      INSERT INTO transactions(date, type, category, description, amount_cents)
      VALUES (@date, @type, @category, @description, @amount_cents)
    `
    )
    .run({ date, type, category, description, amount_cents });

  const row = db
    .prepare(
      `SELECT id, date, type, category, description, amount_cents, created_at
       FROM transactions WHERE id = ?`
    )
    .get(info.lastInsertRowid);

  res.status(201).json(row);
});

app.put("/api/transactions/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid id" });

  const parsed = TransactionPatchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
  }

  const existing = db
    .prepare(`SELECT id, date, type, category, description, amount_cents FROM transactions WHERE id = ?`)
    .get(id);
  if (!existing) return res.status(404).json({ error: "Not found" });

  const next = { ...existing, ...parsed.data };
  db.prepare(
    `
    UPDATE transactions
    SET date=@date, type=@type, category=@category, description=@description, amount_cents=@amount_cents
    WHERE id=@id
  `
  ).run({ ...next, id });

  const row = db
    .prepare(
      `SELECT id, date, type, category, description, amount_cents, created_at
       FROM transactions WHERE id = ?`
    )
    .get(id);
  res.json(row);
});

app.delete("/api/transactions/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid id" });

  const info = db.prepare(`DELETE FROM transactions WHERE id = ?`).run(id);
  if (info.changes === 0) return res.status(404).json({ error: "Not found" });
  res.json({ ok: true });
});

app.get("/api/summary/monthly", (req, res) => {
  const yearRaw = Number(req.query.year);
  const year = Number.isFinite(yearRaw) ? yearRaw : new Date().getFullYear();

  const start = `${year}-01-01`;
  const end = `${year}-12-31`;

  const rows = db
    .prepare(
      `
      SELECT substr(date, 1, 7) as month, type, SUM(amount_cents) as total_cents
      FROM transactions
      WHERE date >= @start AND date <= @end
      GROUP BY month, type
      ORDER BY month ASC
    `
    )
    .all({ start, end });

  const series = rowsToMonthlySeries(rows, year);
  const totals = series.reduce(
    (acc, m) => {
      acc.revenue_cents += m.revenue_cents;
      acc.expense_cents += m.expense_cents;
      acc.profit_cents += m.profit_cents;
      return acc;
    },
    { revenue_cents: 0, expense_cents: 0, profit_cents: 0 }
  );

  res.json({ year, totals, months: series });
});

app.get("/api/summary/yearly", (_req, res) => {
  const rows = db
    .prepare(
      `
      SELECT substr(date, 1, 4) as year, type, SUM(amount_cents) as total_cents
      FROM transactions
      GROUP BY year, type
      ORDER BY year ASC
    `
    )
    .all();

  const byYear = new Map();
  for (const r of rows) {
    const y = r.year;
    if (!byYear.has(y)) byYear.set(y, { revenue_cents: 0, expense_cents: 0 });
    const rec = byYear.get(y);
    if (r.type === "revenue") rec.revenue_cents += r.total_cents;
    if (r.type === "expense") rec.expense_cents += r.total_cents;
  }

  const items = Array.from(byYear.entries()).map(([year, v]) => ({
    year: Number(year),
    revenue_cents: v.revenue_cents,
    expense_cents: v.expense_cents,
    profit_cents: v.revenue_cents - v.expense_cents,
  }));

  res.json({ items });
});

app.get("/api/summary/categories", (req, res) => {
  const yearRaw = Number(req.query.year);
  const year = Number.isFinite(yearRaw) ? yearRaw : new Date().getFullYear();
  const monthRaw = typeof req.query.month === "string" ? req.query.month : null; // "01".."12" or null

  let start = `${year}-01-01`;
  let end = `${year}-12-31`;
  if (monthRaw && /^\d{2}$/.test(monthRaw)) {
    start = `${year}-${monthRaw}-01`;
    end = `${year}-${monthRaw}-31`;
  }

  const rows = db
    .prepare(
      `
      SELECT category, type, SUM(amount_cents) as total_cents
      FROM transactions
      WHERE date >= @start AND date <= @end
      GROUP BY category, type
      ORDER BY total_cents DESC
    `
    )
    .all({ start, end });

  const byCategory = new Map();
  for (const r of rows) {
    if (!byCategory.has(r.category)) {
      byCategory.set(r.category, { revenue_cents: 0, expense_cents: 0 });
    }
    const rec = byCategory.get(r.category);
    if (r.type === "revenue") rec.revenue_cents += r.total_cents;
    if (r.type === "expense") rec.expense_cents += r.total_cents;
  }

  const items = Array.from(byCategory.entries()).map(([category, v]) => ({
    category,
    revenue_cents: v.revenue_cents,
    expense_cents: v.expense_cents,
    net_cents: v.revenue_cents - v.expense_cents,
  }));

  res.json({ year, month: monthRaw, items });
});

app.get("/api/analysis/profit-trend", (req, res) => {
  const months = Math.max(3, Math.min(60, Number(req.query.months || 24)));
  const now = new Date();
  const endYear = now.getFullYear();
  const endMonth = now.getMonth() + 1;

  const keys = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(endYear, endMonth - 1 - i, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    keys.push(`${y}-${m}`);
  }

  const startKey = keys[0];
  const endKey = keys[keys.length - 1];
  const start = `${startKey}-01`;
  const end = `${endKey}-31`;

  const rows = db
    .prepare(
      `
      SELECT substr(date, 1, 7) as month, type, SUM(amount_cents) as total_cents
      FROM transactions
      WHERE date >= @start AND date <= @end
      GROUP BY month, type
      ORDER BY month ASC
    `
    )
    .all({ start, end });

  const byMonth = new Map(keys.map((k) => [k, { revenue_cents: 0, expense_cents: 0 }]));
  for (const r of rows) {
    if (!byMonth.has(r.month)) continue;
    const rec = byMonth.get(r.month);
    if (r.type === "revenue") rec.revenue_cents += r.total_cents;
    if (r.type === "expense") rec.expense_cents += r.total_cents;
  }

  const series = keys.map((month) => {
    const v = byMonth.get(month);
    return {
      month,
      revenue_cents: v.revenue_cents,
      expense_cents: v.expense_cents,
      profit_cents: v.revenue_cents - v.expense_cents,
    };
  });

  res.json({ months, series });
});

app.get("/api/people", (_req, res) => {
  const rows = db
    .prepare(
      `SELECT id, name, created_at
       FROM people
       ORDER BY name ASC`
    )
    .all();
  res.json({ items: rows });
});

app.post("/api/people", (req, res) => {
  const parsed = PersonSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
  }
  const info = db
    .prepare(
      `INSERT INTO people(name)
       VALUES (@name)`
    )
    .run({ name: parsed.data.name });

  const row = db
    .prepare(`SELECT id, name, created_at FROM people WHERE id = ?`)
    .get(info.lastInsertRowid);
  res.status(201).json(row);
});

app.post("/api/people/:id/orders", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid id" });

  const parsed = PersonOrderSchema.safeParse({ ...req.body, person_id: id });
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
  }
  const { person_id, date, cost_cents } = parsed.data;

  const person = db.prepare(`SELECT id FROM people WHERE id = ?`).get(person_id);
  if (!person) return res.status(404).json({ error: "Person not found" });

  const info = db
    .prepare(
      `INSERT INTO person_orders(person_id, date, cost_cents)
       VALUES (@person_id, @date, @cost_cents)`
    )
    .run({ person_id, date, cost_cents });

  const row = db
    .prepare(
      `SELECT id, person_id, date, cost_cents, created_at
       FROM person_orders
       WHERE id = ?`
    )
    .get(info.lastInsertRowid);
  res.status(201).json(row);
});

app.get("/api/people/:id/orders", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid id" });

  const yearRaw = Number(req.query.year);
  const year = Number.isFinite(yearRaw) ? yearRaw : new Date().getFullYear();
  const monthRaw = typeof req.query.month === "string" ? req.query.month : null;

  let start = `${year}-01-01`;
  let end = `${year}-12-31`;
  if (monthRaw && /^\d{2}$/.test(monthRaw)) {
    start = `${year}-${monthRaw}-01`;
    end = `${year}-${monthRaw}-31`;
  }

  const person = db.prepare(`SELECT id, name FROM people WHERE id = ?`).get(id);
  if (!person) return res.status(404).json({ error: "Person not found" });

  const items = db
    .prepare(
      `SELECT id, person_id, date, cost_cents, created_at
       FROM person_orders
       WHERE person_id = @id AND date >= @start AND date <= @end
       ORDER BY date DESC, id DESC`
    )
    .all({ id, start, end });

  const totals = items.reduce(
    (acc, o) => {
      acc.total_cents += o.cost_cents;
      acc.days += 1;
      return acc;
    },
    { total_cents: 0, days: 0 }
  );

  res.json({ person, year, month: monthRaw, totals, items });
});

app.get("/api/people/:id/summary/yearly", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid id" });

  const person = db.prepare(`SELECT id, name FROM people WHERE id = ?`).get(id);
  if (!person) return res.status(404).json({ error: "Person not found" });

  const rows = db
    .prepare(
      `
      SELECT substr(date, 1, 4) as year, SUM(cost_cents) as total_cents, COUNT(*) as days
      FROM person_orders
      WHERE person_id = @id
      GROUP BY year
      ORDER BY year ASC
    `
    )
    .all({ id });

  res.json({ person, items: rows });
});

app.get("/api/people/:id/summary/monthly", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid id" });

  const yearRaw = Number(req.query.year);
  const year = Number.isFinite(yearRaw) ? yearRaw : new Date().getFullYear();

  const person = db.prepare(`SELECT id, name FROM people WHERE id = ?`).get(id);
  if (!person) return res.status(404).json({ error: "Person not found" });

  const rows = db
    .prepare(
      `
      SELECT substr(date, 1, 7) as month, SUM(cost_cents) as total_cents, COUNT(*) as days
      FROM person_orders
      WHERE person_id = @id AND substr(date, 1, 4) = @year
      GROUP BY month
      ORDER BY month ASC
    `
    )
    .all({ id, year: String(year) });

  res.json({ person, year, items: rows });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});

