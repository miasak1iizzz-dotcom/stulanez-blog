import type {
	HitokotoQuote,
	TimeProgressMilestone,
} from "../types/atmosphereConfig";

export type ZonedDateParts = {
	year: number;
	month: number;
	day: number;
	hour: number;
	minute: number;
	second: number;
	weekday: number; // 0 = Sunday
};

export type ProgressSlice = {
	percent: number;
	remainingDays: number;
};

export type NextStation = {
	name: string;
	remainingDays: number;
	dateLabel: string;
};

export type TimeProgressSnapshot = {
	year: ProgressSlice;
	month: ProgressSlice;
	week: ProgressSlice;
	next: NextStation | null;
};

export type ClockGreetingPeriod =
	| "morning"
	| "noon"
	| "afternoon"
	| "evening"
	| "night";

const WEEKDAY_INDEX: Record<string, number> = {
	Sun: 0,
	Mon: 1,
	Tue: 2,
	Wed: 3,
	Thu: 4,
	Fri: 5,
	Sat: 6,
};

function readPart(
	parts: Intl.DateTimeFormatPart[],
	type: Intl.DateTimeFormatPartTypes,
): string {
	return parts.find((part) => part.type === type)?.value || "";
}

export function getZonedDateParts(
	date: Date,
	timeZone: string,
): ZonedDateParts {
	const parts = new Intl.DateTimeFormat("en-US", {
		timeZone,
		weekday: "short",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		hourCycle: "h23",
	}).formatToParts(date);

	const weekdayLabel = readPart(parts, "weekday");
	return {
		year: Number(readPart(parts, "year")),
		month: Number(readPart(parts, "month")),
		day: Number(readPart(parts, "day")),
		hour: Number(readPart(parts, "hour")),
		minute: Number(readPart(parts, "minute")),
		second: Number(readPart(parts, "second")),
		weekday: WEEKDAY_INDEX[weekdayLabel] ?? 0,
	};
}

function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
	const zoned = getZonedDateParts(date, timeZone);
	const asUtc = Date.UTC(
		zoned.year,
		zoned.month - 1,
		zoned.day,
		zoned.hour,
		zoned.minute,
		zoned.second,
	);
	return asUtc - date.getTime();
}

export function zonedLocalToDate(
	year: number,
	month: number,
	day: number,
	hour: number,
	minute: number,
	second: number,
	timeZone: string,
): Date {
	let utc = Date.UTC(year, month - 1, day, hour, minute, second);
	for (let i = 0; i < 3; i += 1) {
		const offset = getTimeZoneOffsetMs(new Date(utc), timeZone);
		utc = Date.UTC(year, month - 1, day, hour, minute, second) - offset;
	}
	return new Date(utc);
}

export function getZonedDateKey(date: Date, timeZone: string): string {
	const parts = getZonedDateParts(date, timeZone);
	const month = String(parts.month).padStart(2, "0");
	const day = String(parts.day).padStart(2, "0");
	return `${parts.year}-${month}-${day}`;
}

export function pickDailyQuote(
	quotes: HitokotoQuote[],
	date: Date,
	timeZone: string,
): HitokotoQuote | null {
	if (quotes.length === 0) {
		return null;
	}
	const parts = getZonedDateParts(date, timeZone);
	const start = zonedLocalToDate(parts.year, 1, 1, 0, 0, 0, timeZone);
	const dayOfYear = Math.floor((date.getTime() - start.getTime()) / 86_400_000);
	const index = ((dayOfYear % quotes.length) + quotes.length) % quotes.length;
	return quotes[index] ?? quotes[0];
}

function clampPercent(value: number): number {
	if (!Number.isFinite(value)) {
		return 0;
	}
	return Math.min(100, Math.max(0, value));
}

function remainingDays(nowMs: number, endMs: number): number {
	return Math.max(0, Math.ceil((endMs - nowMs) / 86_400_000));
}

function makeSlice(
	nowMs: number,
	startMs: number,
	endMs: number,
): ProgressSlice {
	const span = Math.max(1, endMs - startMs);
	return {
		percent: clampPercent(((nowMs - startMs) / span) * 100),
		remainingDays: remainingDays(nowMs, endMs),
	};
}

export function getClockGreetingPeriod(hour: number): ClockGreetingPeriod {
	if (hour >= 5 && hour < 11) {
		return "morning";
	}
	if (hour >= 11 && hour < 14) {
		return "noon";
	}
	if (hour >= 14 && hour < 18) {
		return "afternoon";
	}
	if (hour >= 18 && hour < 23) {
		return "evening";
	}
	return "night";
}

export function getTimeProgress(
	date: Date,
	timeZone: string,
	milestones: TimeProgressMilestone[],
): TimeProgressSnapshot {
	const parts = getZonedDateParts(date, timeZone);
	const nowMs = date.getTime();

	const yearStart = zonedLocalToDate(parts.year, 1, 1, 0, 0, 0, timeZone);
	const yearEnd = zonedLocalToDate(parts.year + 1, 1, 1, 0, 0, 0, timeZone);

	const monthStart = zonedLocalToDate(
		parts.year,
		parts.month,
		1,
		0,
		0,
		0,
		timeZone,
	);
	const nextMonth =
		parts.month === 12
			? zonedLocalToDate(parts.year + 1, 1, 1, 0, 0, 0, timeZone)
			: zonedLocalToDate(parts.year, parts.month + 1, 1, 0, 0, 0, timeZone);

	const daysFromMonday = (parts.weekday + 6) % 7;
	const weekStartDay = parts.day - daysFromMonday;
	const weekStart = zonedLocalToDate(
		parts.year,
		parts.month,
		weekStartDay,
		0,
		0,
		0,
		timeZone,
	);
	const weekEnd = new Date(weekStart.getTime() + 7 * 86_400_000);

	let next: NextStation | null = null;
	for (const milestone of milestones) {
		const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(milestone.date);
		if (!match) {
			continue;
		}
		const start = zonedLocalToDate(
			Number(match[1]),
			Number(match[2]),
			Number(match[3]),
			0,
			0,
			0,
			timeZone,
		);
		if (start.getTime() < nowMs) {
			continue;
		}
		next = {
			name: milestone.name,
			remainingDays: remainingDays(nowMs, start.getTime()),
			dateLabel: milestone.date,
		};
		break;
	}

	return {
		year: makeSlice(nowMs, yearStart.getTime(), yearEnd.getTime()),
		month: makeSlice(nowMs, monthStart.getTime(), nextMonth.getTime()),
		week: makeSlice(nowMs, weekStart.getTime(), weekEnd.getTime()),
		next,
	};
}

export function formatClockTime(parts: ZonedDateParts): string {
	const hour = String(parts.hour).padStart(2, "0");
	const minute = String(parts.minute).padStart(2, "0");
	const second = String(parts.second).padStart(2, "0");
	return `${hour}:${minute}:${second}`;
}

export function formatClockDate(parts: ZonedDateParts): string {
	const month = String(parts.month).padStart(2, "0");
	const day = String(parts.day).padStart(2, "0");
	return `${month}/${day}`;
}
