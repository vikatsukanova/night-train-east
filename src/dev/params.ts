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
	const rideT = parseFiniteNonNegative(params.get("t"));
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
