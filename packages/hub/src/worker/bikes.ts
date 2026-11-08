import { env } from "cloudflare:workers";
import { Hono } from "hono";
import { requireScope } from "./auth.ts";

// Read routes over the bikes app's database (APP_BIKES). The bikes Worker owns the schema
// (usmanity/bikes, migrations/) and writes through /api/apps/bikes/query; these routes only read,
// so a change to the bikes schema may need a matching change here.
const bikesDb = () => (env as unknown as { APP_BIKES: D1Database }).APP_BIKES;

export const bikes = new Hono();

// GET /api/bikes → every table, flat, ids intact (photo bytes are left out; see /photos/:bikeId).
bikes.get("/", requireScope("bikes:read"), async (c) => {
	const db = bikesDb();
	const [bikeRows, mileage, components, events, photos] = await db.batch([
		db.prepare("SELECT * FROM bikes ORDER BY id"),
		db.prepare("SELECT * FROM mileage_updates ORDER BY id"),
		db.prepare("SELECT * FROM components ORDER BY id"),
		db.prepare("SELECT * FROM events ORDER BY id"),
		db.prepare("SELECT bike_id, mime, byte_size, updated_at FROM bike_photos ORDER BY bike_id"),
	]);
	return c.json({
		source: "bikes",
		exported_at: Math.floor(Date.now() / 1000),
		bikes: bikeRows.results,
		mileage_updates: mileage.results,
		components: components.results,
		events: events.results,
		bike_photos: photos.results,
	});
});

// GET /api/bikes/latest → the most recent change to any bike (see latestBikeUpdate).
bikes.get("/latest", requireScope("bikes:read"), async (c) => {
	const latest = await latestBikeUpdate();
	return latest ? c.json(latest) : c.json({ error: "not_found" }, 404);
});

// GET /api/bikes/photos/:bikeId → the stored photo for one bike.
bikes.get("/photos/:bikeId", requireScope("bikes:read"), async (c) => {
	const id = Number(c.req.param("bikeId"));
	if (!Number.isInteger(id)) return c.json({ error: "not_found" }, 404);
	const row = await bikesDb().prepare("SELECT mime, bytes FROM bike_photos WHERE bike_id = ?")
		.bind(id)
		.first<{ mime: string; bytes: ArrayBuffer | number[] }>();
	if (!row) return c.json({ error: "not_found" }, 404);
	const body = Array.isArray(row.bytes) ? new Uint8Array(row.bytes) : row.bytes;
	return c.body(body, 200, { "content-type": row.mime });
});

export type BikeUpdate = {
	bike_id: number;
	bike: string;
	kind: "mileage" | "event" | "component" | "bike";
	/** What changed: the odometer reading, the event or part name, or null for a details edit. */
	what: string | null;
	/** The bike's latest odometer reading, if it has one. */
	miles: number | null;
	/** Unix seconds. */
	updated_at: number;
};

// The newest row across mileage, events, parts and bike edits, with the bike it belongs to.
export async function latestBikeUpdate(): Promise<BikeUpdate | null> {
	return await bikesDb().prepare(`
		SELECT u.bike_id, b.name AS bike, u.kind, u.what, u.at AS updated_at,
			(SELECT mileage FROM mileage_updates m WHERE m.bike_id = u.bike_id
			 ORDER BY created_at DESC, id DESC LIMIT 1) AS miles
		FROM (
			SELECT bike_id, 'mileage' AS kind, CAST(mileage AS TEXT) AS what, created_at AS at FROM mileage_updates
			UNION ALL SELECT bike_id, 'event', name, created_at FROM events
			UNION ALL SELECT bike_id, 'component', trim(brand || ' ' || name), created_at FROM components
			UNION ALL SELECT id, 'bike', NULL, updated_at FROM bikes
		) u JOIN bikes b ON b.id = u.bike_id
		ORDER BY u.at DESC LIMIT 1`).first<BikeUpdate>();
}
