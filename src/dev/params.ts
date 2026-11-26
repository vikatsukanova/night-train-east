import {
	DEFAULT_DURATION_SEC,
	DEFAULT_END_HOUR,
	DEFAULT_START_HOUR,
} from "../core/clock";

// Invert the default RouteClock's linear dusk-to-dawn mapping for M1 (22:45).
const M1_HOUR = 22.75;
const M1_RIDE_T =
	(DEFAULT_DURATION_SEC * (M1_HOUR - DEFAULT_START_HOUR)) /
	(DEFAULT_END_HOUR - DEFAULT_START_HOUR);

export interface DevParams {
	readonly rideT?: number;
	readonly seed?: number;
	readonly speedKmh?: number;
	readonly hideOverlay: boolean;
}

function parseFiniteNonNegative(raw: string | null): number | undefined {
	if (raw === null || raw.trim() === "") return undefined;
	const value = Number(raw);
	if (!Number.isFinite(value) || value < 0) return undefined;
	return value;
}

function parseFiniteInt(raw: string | null): number | undefined {
	if (raw === null || raw.trim() === "") return undefined;
	const value = Number(raw);
	if (!Number.isFinite(value)) return undefined;
	return Math.trunc(value);
}

export function parseDevParams(search: string): DevParams {
	const params = new URLSearchParams(search);
	const rideT =
		parseFiniteNonNegative(params.get("t")) ??
		(params.get("moment") === "M1" ? M1_RIDE_T : undefined);
	const seed = parseFiniteInt(params.get("seed"));
	const speedKmh = parseFiniteNonNegative(params.get("speed"));
	const hideOverlay =
		params.has("nohud") ||
		params.get("stats") === "0" ||
		params.get("debug") === "0";

	return {
		...(rideT !== undefined ? { rideT } : {}),
		...(seed !== undefined ? { seed } : {}),
		...(speedKmh !== undefined ? { speedKmh } : {}),
		hideOverlay,
	};
}
