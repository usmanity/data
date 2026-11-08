import { useEffect, useState } from "react";

type Health = { ok: boolean; migrations: number };

export function App() {
	const [health, setHealth] = useState<Health | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		fetch("/api/health")
			.then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
			.then((body: Health) => setHealth(body))
			.catch((err: Error) => setError(err.message));
	}, []);

	return (
		<main style={{ padding: 16 }}>
			<h1>data.usmanity.com</h1>
			{error && <p>API error: {error}</p>}
			{!error && !health && <p>Checking API…</p>}
			{health && (
				<p>
					API ok · {health.migrations} migration{health.migrations === 1 ? "" : "s"} applied
				</p>
			)}
		</main>
	);
}
