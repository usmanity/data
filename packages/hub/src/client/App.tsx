import { type ReactNode, useEffect, useState } from "react";
import { Line, LineChart, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { cn } from "@/lib/utils";
import type { ActivityItem, MoneyItem, Summary, SummaryItem } from "../shared/summary.ts";

// -123000 → "-123K"
function thousands(dollars: number): string {
	const k = Math.round(dollars / 1000);
	return `${k < 0 ? "-" : ""}${Math.abs(k).toLocaleString("en-US")}K`;
}

// -1000 → "−$1K", 2000 → "+$2K"
function signedDollars(dollars: number): string {
	const k = Math.round(dollars / 1000);
	if (k === 0) return "±$0K";
	return `${k > 0 ? "+" : "−"}$${Math.abs(k).toLocaleString("en-US")}K`;
}

// "2026-11" → "Nov 2026"
function monthLabel(month: string): string {
	const [y, m] = month.split("-").map(Number);
	return new Date(Date.UTC(y, m - 1)).toLocaleString("en-US", {
		month: "short",
		year: "numeric",
		timeZone: "UTC",
	});
}

// 1794100000 → "Nov 7, 2026"
function dayLabel(seconds: number): string {
	return new Date(seconds * 1000).toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

type Direction = "up" | "down" | "flat";
const directionOf = (n: number): Direction => (n > 0 ? "up" : n < 0 ? "down" : "flat");
const directionClass: Record<Direction, string> = {
	up: "text-up",
	down: "text-down",
	flat: "",
};

// Every card shares this frame and ends with when its data last changed in the database.
function SummaryCard({ label, updatedAt, children }: { label: string; updatedAt?: number; children: ReactNode }) {
	return (
		<Card className="gap-3 py-5 shadow-none">
			<CardHeader className="px-5">
				<CardTitle className="text-xs font-normal uppercase text-muted-foreground">{label}</CardTitle>
			</CardHeader>
			<CardContent className="px-5">{children}</CardContent>
			{updatedAt ? (
				<CardFooter className="px-5 text-sm text-muted-foreground">Updated {dayLabel(updatedAt)}</CardFooter>
			) : null}
		</Card>
	);
}

function Headline({ children }: { children: ReactNode }) {
	return <p className="mb-3 text-5xl leading-none font-bold">{children}</p>;
}

function Stats({ children }: { children: ReactNode }) {
	return <dl className="mb-3 text-sm">{children}</dl>;
}

function Stat({ term, children, className }: { term: string; children: ReactNode; className?: string }) {
	return (
		<div className="flex justify-between gap-4 py-0.5">
			<dt className="text-muted-foreground">{term}</dt>
			<dd className={cn("text-right", className)}>{children}</dd>
		</div>
	);
}

function Item({ item }: { item: SummaryItem }) {
	return item.kind === "activity" ? <Activity item={item} /> : <Money item={item} />;
}

function Activity({ item }: { item: ActivityItem }) {
	return (
		<SummaryCard label={item.label} updatedAt={item.updated_at}>
			<Headline>{item.title}</Headline>
			<Stats>
				<Stat term="last miles">{item.detail}</Stat>
			</Stats>
		</SummaryCard>
	);
}

// The last year as a line. Hovering (or arrow keys once focused) snaps a hairline to the nearest
// month and shows that month's net worth, value first. Older cached summaries may not carry
// history, hence the guards.
function TrendLine({ points }: { points: { month: string; value: number }[] }) {
	if (points.length < 2) return null;
	const trend = directionOf(points.at(-1)!.value - points[0].value);
	const config = {
		value: {
			label: "Net worth",
			color: trend === "up" ? "var(--up)" : trend === "down" ? "var(--down)" : "var(--muted-foreground)",
		},
	} satisfies ChartConfig;
	return (
		<ChartContainer config={config} className="mb-1 aspect-auto h-16 w-full">
			<LineChart data={points} margin={{ top: 6, right: 6, bottom: 6, left: 6 }} accessibilityLayer>
				<XAxis dataKey="month" hide />
				<YAxis domain={["dataMin", "dataMax"]} hide />
				<ChartTooltip
					cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1 }}
					isAnimationActive={false}
					content={
						<ChartTooltipContent
							indicator="line"
							labelFormatter={(_, payload) => monthLabel(String(payload?.[0]?.payload?.month ?? ""))}
							formatter={(value) => <span className="font-semibold text-foreground">{thousands(Number(value))}</span>}
						/>
					}
				/>
				<Line
					type="linear"
					dataKey="value"
					stroke="var(--color-value)"
					strokeWidth={2}
					dot={false}
					activeDot={{ r: 4, fill: "var(--color-value)", stroke: "var(--background)", strokeWidth: 2 }}
					isAnimationActive={false}
				/>
			</LineChart>
		</ChartContainer>
	);
}

function Money({ item }: { item: MoneyItem }) {
	const perMonth = (n: number | null | undefined, months: number) =>
		n === null || n === undefined ? null : (
			<span className={directionClass[directionOf(n)]} key={months}>
				{signedDollars(n)}/mo <span className="text-muted-foreground">({months} mo)</span>
			</span>
		);
	const trend = [perMonth(item.avg_change_3m, 3), perMonth(item.avg_change_6m, 6)].filter(Boolean);
	return (
		<SummaryCard label={item.label} updatedAt={item.updated_at}>
			<Headline>{thousands(item.value)}</Headline>
			<Stats>
				{item.change !== null && item.previous_month && (
					<Stat term={`vs ${monthLabel(item.previous_month)}`} className={directionClass[directionOf(item.change)]}>
						{signedDollars(item.change)}
					</Stat>
				)}
				{item.change_since_first_pct != null && item.first_month && (
					<Stat
						term={`since ${monthLabel(item.first_month)}`}
						className={directionClass[directionOf(item.change_since_first_pct)]}
					>
						{item.change_since_first_pct > 0 ? "+" : ""}
						{item.change_since_first_pct}%
					</Stat>
				)}
				{trend.length > 0 && (
					<Stat term="trend">{trend.reduce<ReactNode[]>((acc, el, i) => (i ? [...acc, " · ", el] : [el]), [])}</Stat>
				)}
			</Stats>
			{item.history && <TrendLine points={item.history} />}
		</SummaryCard>
	);
}

export function App() {
	const [summary, setSummary] = useState<Summary | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		fetch("/api/summary")
			.then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
			.then((body: Summary) => setSummary(body))
			.catch((err: Error) => setError(err.message));
	}, []);

	const note = "text-sm text-muted-foreground";
	return (
		<main className="mx-auto max-w-[52rem] px-5 py-12">
			<h1 className="mb-10 text-base font-normal text-muted-foreground">data.usmanity.com</h1>
			{error && <p className={note}>Couldn't load the data ({error}).</p>}
			{!error && !summary && <p className={note}>Loading…</p>}
			{summary && summary.items.length === 0 && <p className={note}>Nothing here yet.</p>}
			{summary && summary.items.length > 0 && (
				<section className="grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-5">
					{summary.items.map((item) => (
						<Item key={item.id} item={item} />
					))}
				</section>
			)}
		</main>
	);
}
