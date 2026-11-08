#!/usr/bin/env node
// Imports monthly net worth history from a CSV export of the "Road to 10" sheet's
// Overview tab (columns: Month, Net worth, Assets, Liabilities, as formatted in the sheet).
//
//   node scripts/import-networth.mjs ../../private/networth-road-to-10.csv            # local D1
//   node scripts/import-networth.mjs ../../private/networth-road-to-10.csv --remote   # remote D1
//   node scripts/import-networth.mjs <csv> --dry-run                                  # print SQL
//
// Re-running is safe: rows are upserted by month, and months whose source is no longer
// "road-to-10" (e.g. fixed by hand through PUT /api/networth/:month) are left alone.
import { readFileSync } from "node:fs";
import { runSql } from "./d1.mjs";

const SOURCE = "road-to-10";
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August",
	"September", "October", "November", "December"];

const args = process.argv.slice(2);
const csvPath = args.find((a) => !a.startsWith("--"));
const remote = args.includes("--remote");
const dryRun = args.includes("--dry-run");
if (!csvPath) {
	console.error("usage: import-networth.mjs <csv> [--remote] [--dry-run]");
	process.exit(1);
}

function parseCsvLine(line) {
	const cells = [];
	let cell = "";
	let quoted = false;
	for (const ch of line) {
		if (ch === '"') quoted = !quoted;
		else if (ch === "," && !quoted) {
			cells.push(cell);
			cell = "";
		} else cell += ch;
	}
	cells.push(cell);
	return cells;
}

// "-$1,234,567.89" → -123456789
function toCents(money) {
	const m = money.trim().match(/^(-?)\$([\d,]+)\.(\d{2})$/);
	if (!m) throw new Error(`bad amount: ${money}`);
	return (m[1] ? -1 : 1) * (Number(m[2].replaceAll(",", "")) * 100 + Number(m[3]));
}

// "March, 2021" → "2021-03"
function toMonth(label) {
	const m = label.trim().match(/^(\w+),\s*(\d{4})$/);
	const index = m ? MONTHS.indexOf(m[1]) : -1;
	if (index < 0) throw new Error(`bad month: ${label}`);
	return `${m[2]}-${String(index + 1).padStart(2, "0")}`;
}

const [header, ...lines] = readFileSync(csvPath, "utf8").trim().split(/\r?\n/);
const cols = parseCsvLine(header).map((h) => h.trim().toLowerCase());
const at = (name) => {
	const i = cols.indexOf(name);
	if (i < 0) throw new Error(`missing column: ${name}`);
	return i;
};
const [iMonth, iNet, iAssets, iLiab] = ["month", "net worth", "assets", "liabilities"].map(at);

const rows = [];
for (const line of lines) {
	const cells = parseCsvLine(line);
	if (!cells[iMonth]?.trim()) continue;
	const month = toMonth(cells[iMonth]);
	const assets = toCents(cells[iAssets]);
	const liabilities = -toCents(cells[iLiab]); // the sheet shows liabilities as negative
	const net = toCents(cells[iNet]);
	if (assets - liabilities !== net) {
		throw new Error(`${month}: assets - liabilities = ${assets - liabilities}, sheet says ${net}`);
	}
	const prev = rows.at(-1);
	if (prev && month <= prev.month) throw new Error(`${month}: months must increase`);
	const repeated = prev && prev.assets === assets && prev.liabilities === liabilities;
	const note = repeated ? "Same figures as the previous month in the sheet; likely not updated." : null;
	rows.push({ month, assets, liabilities, note });
}
if (rows.length === 0) throw new Error("no rows found");

const sqlString = (s) => (s === null ? "NULL" : `'${s.replaceAll("'", "''")}'`);
const sql = `INSERT INTO networth_snapshots (month, assets_cents, liabilities_cents, source, note) VALUES
${rows.map((r) => `  ('${r.month}', ${r.assets}, ${r.liabilities}, '${SOURCE}', ${sqlString(r.note)})`).join(",\n")}
ON CONFLICT (month) DO UPDATE SET
  assets_cents = excluded.assets_cents,
  liabilities_cents = excluded.liabilities_cents,
  note = excluded.note,
  updated_at = unixepoch()
WHERE networth_snapshots.source = '${SOURCE}';`;

if (dryRun) {
	console.log(sql);
	process.exit(0);
}

runSql(sql, [], { remote });
const repeats = rows.filter((r) => r.note).map((r) => r.month);
console.log(
	`imported ${rows.length} months (${rows[0].month} → ${rows.at(-1).month}) into ${remote ? "remote" : "local"} D1`,
);
if (repeats.length) console.log(`repeated previous month's figures: ${repeats.join(", ")}`);
