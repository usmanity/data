import { env } from "cloudflare:workers";
import { Hono } from "hono";
import { requireScope } from "./auth.ts";

// POST /api/apps/:app/query runs SQL against one app's own database: the APP_<NAME> D1 binding
// that cloudflare.config.ts declares for each entry in its appDatabases list.
//
//   { "statements": [{ "sql": "SELECT * FROM bikes WHERE id = ?", "params": [1] }, ...] }
//
// The statements run as one D1 batch (a transaction), and the answer has one entry per
// statement: { "results": [{ "results": [rows], "meta": { changes, last_row_id } }] }.
// Blobs travel as { "$blob": "<base64>" } in both directions.
//
// `<app>:write` may run anything. `<app>:read` may only run single SELECT statements.

type Param = null | number | string | boolean | { $blob: string };
type Statement = { sql: string; params?: Param[] };

const MAX_BODY_BYTES = 8 * 1024 * 1024;
const MAX_STATEMENTS = 100;

export const apps = new Hono();

apps.post(
	"/:app/query",
	async (c, next) => {
		// Unknown apps 404 before auth, like any other bad path.
		if (!appDatabase(c.req.param("app"))) return c.json({ error: "not_found" }, 404);
		await next();
	},
	requireScope((c) => [`${c.req.param("app")}:write`, `${c.req.param("app")}:read`]),
	async (c) => {
		const app = c.req.param("app");
		if (Number(c.req.header("content-length") ?? 0) > MAX_BODY_BYTES) {
			return c.json({ error: "too_large" }, 413);
		}
		const body = await c.req.json<{ statements?: Statement[] }>().catch(() => null);
		const statements = body?.statements;
		if (
			!Array.isArray(statements) || statements.length === 0 || statements.length > MAX_STATEMENTS ||
			!statements.every((s) => typeof s?.sql === "string" && (s.params === undefined || Array.isArray(s.params)))
		) {
			return c.json({ error: "bad_request", message: "expected { statements: [{ sql, params? }] }" }, 400);
		}

		if (!c.get("scopes").includes(`${app}:write`) && !statements.every((s) => isSingleSelect(s.sql))) {
			return c.json({ error: "forbidden", message: `${app}:read only allows SELECT` }, 403);
		}

		const db = appDatabase(app)!;
		try {
			const out = await db.batch(
				statements.map((s) => db.prepare(s.sql).bind(...(s.params ?? []).map(decodeValue))),
			);
			return c.json({
				results: out.map((r) => ({
					results: ((r.results ?? []) as Record<string, unknown>[]).map(encodeRow),
					meta: { changes: r.meta.changes, last_row_id: r.meta.last_row_id, duration: r.meta.duration },
				})),
			});
		} catch (err) {
			return c.json({ error: "sql_error", message: (err as Error).message }, 400);
		}
	},
);

function appDatabase(app: string): D1Database | undefined {
	if (!/^[a-z][a-z0-9_]*$/.test(app)) return undefined;
	const binding = (env as unknown as Record<string, unknown>)[`APP_${app.toUpperCase()}`];
	return binding && typeof (binding as D1Database).batch === "function" ? (binding as D1Database) : undefined;
}

// Conservative: one statement, starting with SELECT. (WITH is left out because a CTE can
// front an INSERT/UPDATE/DELETE.) Comments are stripped first so they can't hide a second
// statement or the leading keyword.
function isSingleSelect(sql: string): boolean {
	const s = sql.replace(/--[^\n]*/g, " ").replace(/\/\*[\s\S]*?\*\//g, " ").trim().replace(/;\s*$/, "");
	return /^select\b/i.test(s) && !s.includes(";");
}

function decodeValue(v: Param): unknown {
	if (v && typeof v === "object" && typeof v.$blob === "string") {
		const bin = atob(v.$blob);
		const bytes = new Uint8Array(bin.length);
		for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
		return bytes.buffer;
	}
	return v;
}

// D1 returns blobs as ArrayBuffer in workerd and as number[] in some other runtimes.
function encodeRow(row: Record<string, unknown>): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	for (const [k, v] of Object.entries(row)) {
		if (v instanceof ArrayBuffer || ArrayBuffer.isView(v) || Array.isArray(v)) {
			out[k] = { $blob: toBase64(v) };
		} else {
			out[k] = v;
		}
	}
	return out;
}

function toBase64(v: ArrayBuffer | ArrayBufferView | number[]): string {
	const bytes = Array.isArray(v)
		? Uint8Array.from(v)
		: v instanceof ArrayBuffer
			? new Uint8Array(v)
			: new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
	let bin = "";
	for (let i = 0; i < bytes.length; i += 0x8000) {
		bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
	}
	return btoa(bin);
}
