import { db } from "./db.ts";
import type { Context } from "hono";
import { createMiddleware } from "hono/factory";

export async function hashToken(token: string): Promise<string> {
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
	return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Requires `Authorization: Bearer <token>` for a live api_tokens row holding `scope` (or, given a
// list, any one of them). The token's scopes are left on the context as c.get("scopes").
export function requireScope(scope: string | string[] | ((c: Context) => string | string[])) {
	return createMiddleware<{ Variables: { scopes: string[] } }>(async (c, next) => {
		const token = c.req.header("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
		if (!token) return c.json({ error: "unauthorized" }, 401);

		const row = await db().prepare(
			"SELECT id, scopes FROM api_tokens WHERE token_hash = ? AND revoked_at IS NULL",
		)
			.bind(await hashToken(token))
			.first<{ id: number; scopes: string }>();
		if (!row) return c.json({ error: "unauthorized" }, 401);
		const wanted = [typeof scope === "function" ? scope(c) : scope].flat();
		const held = row.scopes.split(" ");
		if (!wanted.some((s) => held.includes(s))) return c.json({ error: "forbidden" }, 403);
		c.set("scopes", held);

		await db().prepare("UPDATE api_tokens SET last_used_at = unixepoch() WHERE id = ?")
			.bind(row.id)
			.run();
		await next();
	});
}
