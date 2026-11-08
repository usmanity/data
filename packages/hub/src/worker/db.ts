import { env } from "cloudflare:workers";

// Only the hub build binds D1. The edge build (cloudflare.config.ts) never reaches code that uses it.
export const db = () => env.DB as D1Database;
