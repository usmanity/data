// Runs SQL against the hub's D1 database for the scripts in this folder.
// Remote goes through `cf d1 query`. Local writes the SQLite file cf dev keeps under
// .cloudflare/state (or $HUB_STATE_DIR) directly, because `cf d1 query` has no --local mode.
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

export const hubDir = join(dirname(fileURLToPath(import.meta.url)), "..");

function databaseId() {
	const id = readFileSync(join(hubDir, "cloudflare.config.ts"), "utf8").match(
		/bindings\.d1\(\{[^}]*id:\s*"([^"]+)"/,
	)?.[1];
	if (!id) throw new Error("could not find the D1 id in cloudflare.config.ts");
	return id;
}

function localDatabaseFile() {
	const state = process.env.HUB_STATE_DIR ?? join(hubDir, ".cloudflare/state");
	const dir = join(state, "v3/d1/miniflare-D1DatabaseObject");
	let files;
	try {
		files = readdirSync(dir).filter((f) => f.endsWith(".sqlite") && f !== "metadata.sqlite");
	} catch {
		files = [];
	}
	// App databases (src/worker/app-databases.ts) live in the same folder, so pick the file that
	// holds the hub's own tables.
	const hub = files.filter((f) => {
		const db = new DatabaseSync(join(dir, f), { readOnly: true });
		try {
			return Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'api_tokens'").get());
		} finally {
			db.close();
		}
	});
	if (hub.length !== 1) {
		throw new Error(`expected one hub D1 file in ${dir}, found ${hub.length}; run npm run migrate:local`);
	}
	return join(dir, hub[0]);
}

// Runs one statement with positional params.
export function runSql(sql, params = [], { remote = false } = {}) {
	if (remote) {
		const p = params.length ? ["--params", ...params.map(String)] : [];
		execFileSync("npx", ["cf", "d1", "query", databaseId(), "--sql", sql, ...p], {
			cwd: hubDir,
			stdio: ["ignore", "ignore", "inherit"],
		});
		return;
	}
	const db = new DatabaseSync(localDatabaseFile());
	try {
		db.prepare(sql).run(...params);
	} finally {
		db.close();
	}
}
