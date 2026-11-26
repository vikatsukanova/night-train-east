export const DEFAULT_DURATION_SEC = 1_500;
export const DEFAULT_SPEED_KMH = 60;
export const DEFAULT_START_HOUR = 18.5; // 18:30
export const DEFAULT_END_HOUR = 29 + 10 / 60; // 05:10 next morning

const HOURS_PER_DAY = 24;
const KMH_TO_MPS = 1 / 3.6;

export interface SpeedSegment {
	readonly atSec: number;
	readonly speedKmh: number;
}

export interface RouteClockOptions {
	readonly durationSec?: number;
	readonly startHour?: number;
	readonly endHour?: number;
	readonly segments?: readonly SpeedSegment[];
	readonly initialRideT?: number;
}

function normalizeSegments(
	segments: readonly SpeedSegment[] | undefined,
): readonly SpeedSegment[] {
	if (!segments || segments.length === 0) {
		return [{ atSec: 0, speedKmh: DEFAULT_SPEED_KMH }];
	}
	const sorted = [...segments]
		.map((segment) => ({
			atSec: Math.max(0, segment.atSec),
			speedKmh: Math.max(0, segment.speedKmh),
		}))
		.sort((a, b) => a.atSec - b.atSec);
	const first = sorted[0];
	if (first && first.atSec > 0) {
		sorted.unshift({ atSec: 0, speedKmh: first.speedKmh });
	}
	return sorted;
}

export function formatTimeOfDay(hours: number): string {
	const wrapped = ((hours % HOURS_PER_DAY) + HOURS_PER_DAY) % HOURS_PER_DAY;
	const totalMinutes = Math.round(wrapped * 60) % (HOURS_PER_DAY * 60);
	const hh = Math.floor(totalMinutes / 60);
	const mm = totalMinutes % 60;
	return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export class RouteClock {
	readonly durationSec: number;
	readonly startHour: number;
	readonly endHour: number;
	/** Story hours advanced per real second (e.g. (10h 40m) / 1500s). */
	readonly compressionHoursPerSec: number;
	private readonly segments: readonly SpeedSegment[];
	private currentRideT: number;

	constructor(options: RouteClockOptions = {}) {
		this.durationSec = Math.max(1, options.durationSec ?? DEFAULT_DURATION_SEC);
		this.startHour = options.startHour ?? DEFAULT_START_HOUR;
		const rawEnd = options.endHour ?? DEFAULT_END_HOUR;
		this.endHour = rawEnd >= this.startHour ? rawEnd : rawEnd + HOURS_PER_DAY;
		this.compressionHoursPerSec =
			(this.endHour - this.startHour) / this.durationSec;
		this.segments = normalizeSegments(options.segments);
		this.currentRideT = Math.max(0, options.initialRideT ?? 0);
	}

	get rideT(): number {
		return this.currentRideT;
	}

	get speedKmh(): number {
		return this.speedKmhAt(this.currentRideT);
	}

	get speedMps(): number {
		return this.speedKmh * KMH_TO_MPS;
	}

	get distanceM(): number {
		return this.distanceAt(this.currentRideT);
	}

	/** Clock hour in [0, 24), starting at 18.5 (18:30) and holding at 5.1667 (05:10) once rideT >= durationSec. */
	get timeOfDayHours(): number {
		const clampedRideT = Math.min(this.currentRideT, this.durationSec);
		const continuous =
			this.startHour + clampedRideT * this.compressionHoursPerSec;
		return ((continuous % HOURS_PER_DAY) + HOURS_PER_DAY) % HOURS_PER_DAY;
	}

	advance(dtSeconds: number): void {
		if (!Number.isFinite(dtSeconds) || dtSeconds <= 0) return;
		this.currentRideT += dtSeconds;
	}

	setRideT(seconds: number): void {
		if (!Number.isFinite(seconds)) return;
		this.currentRideT = Math.max(0, seconds);
	}

	speedKmhAt(rideTSeconds: number): number {
		const t = Math.max(0, rideTSeconds);
		let active = this.segments[0]?.speedKmh ?? DEFAULT_SPEED_KMH;
		for (const segment of this.segments) {
			if (segment.atSec <= t) active = segment.speedKmh;
			else break;
		}
		return active;
	}

	distanceAt(rideTSeconds: number): number {
		const targetT = Math.max(0, rideTSeconds);
		let distance = 0;
		for (let i = 0; i < this.segments.length; i++) {
			const segment = this.segments[i];
			if (!segment || segment.atSec >= targetT) break;
			const next = this.segments[i + 1];
			const endT = next ? Math.min(next.atSec, targetT) : targetT;
			if (endT > segment.atSec) {
				distance += (endT - segment.atSec) * (segment.speedKmh * KMH_TO_MPS);
			}
		}
		return distance;
	}
}
