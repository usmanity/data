#!/usr/bin/env node
// Creates an API token and stores only its SHA-256 hash in api_tokens.
// The plaintext token is printed once; save it somewhere safe.
//
//   node scripts/create-token.mjs <name> "<scopes>" [--remote]
//   node scripts/create-token.mjs laptop "finances:read finances:write"
import { createHash, randomBytes } from "node:crypto";
import { runSql } from "./d1.mjs";

const args = process.argv.slice(2);
const [name, scopes] = args.filter((a) => !a.startsWith("--"));
const remote = args.includes("--remote");
if (!name || !scopes) {
	console.error('usage: create-token.mjs <name> "<scope> [scope...]" [--remote]');
	process.exit(1);
}

const token = `du_${randomBytes(24).toString("base64url")}`;
const hash = createHash("sha256").update(token).digest("hex");
runSql("INSERT INTO api_tokens (name, token_hash, scopes) VALUES (?, ?, ?)", [name, hash, scopes], {
	remote,
});
console.log(`token "${name}" (${scopes}) created in ${remote ? "remote" : "local"} D1:`);
console.log(token);
