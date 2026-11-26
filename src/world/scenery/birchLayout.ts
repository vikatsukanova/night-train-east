import { chunkSeed, mulberry32 } from "../../core/rng";
import { CHUNK_LENGTH_M } from "./chunkMath";

/** Minimum lateral clearance from track centerline for all non-track scenery (shared frame contract). */
export const SCENERY_CLEARANCE_X = 2.2;

export const TELEGRAPH_POLE_X = 5.2;
export const TELEGRAPH_POLE_SPACING_M = 40;
export const POLES_PER_CHUNK = CHUNK_LENGTH_M / TELEGRAPH_POLE_SPACING_M;
export const SLEEPERS_PER_CHUNK = 120;

export const MAX_BIRCHES_PER_CHUNK = 220;
export const MAX_SPRUCES_PER_CHUNK = 68;

export const BALLAST_HALF_WIDTH = 1.8;
export const EMBANKMENT_FOOT_X = 5.4;
export const BALLAST_TOP_Y = -1.15;
export const GROUND_BASE_Y = -1.5;

function smoothstep(edge0: number, edge1: number, x: number): number {
	const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
	return t * t * (3 - 2 * t);
}

/**
 * Deterministic terrain height for local coordinates (x, u in [0, CHUNK_LENGTH_M]).
 * Guaranteed continuous across chunk seams: height(x, 0) === height(x, CHUNK_LENGTH_M).
 */
export function terrainHeightAt(x: number, u: number): number {
	const absX = Math.abs(x);
	if (absX <= BALLAST_HALF_WIDTH) {
		return BALLAST_TOP_Y;
	}
	if (absX < EMBANKMENT_FOOT_X) {
		const slope = smoothstep(BALLAST_HALF_WIDTH, EMBANKMENT_FOOT_X, absX);
		return BALLAST_TOP_Y + (GROUND_BASE_Y - BALLAST_TOP_Y) * slope;
	}

	const outDist = absX - EMBANKMENT_FOOT_X;
	const fieldFade = Math.min(1, outDist / 20);
	const hillT = Math.min(1, outDist / 145);
	const sideSign = x >= 0 ? 1 : -1;

	// Cross-section profile shared identically at u = 0 and u = CHUNK_LENGTH_M.
	const baseY =
		GROUND_BASE_Y +
		hillT * hillT * 4.5 +
		Math.sin(absX * 0.11 + sideSign * 0.5) * fieldFade * 0.52;

	// Intra-chunk snowdrift undulation that vanishes at both seams (u = 0 and u = 80).
	const seamEnvelope = Math.sin((Math.PI * u) / CHUNK_LENGTH_M);
	const driftY =
		seamEnvelope *
		Math.sin(x * 0.16 + sideSign * 0.8) *
		Math.min(1, outDist / 12) *
		0.62;

	return baseY + driftY;
}

/**
 * Packed flat typed-array buffer for a single chunk's placements so recycling
 * a chunk incurs zero heap allocations.
 */
export interface ChunkPlacementBuffer {
	birchCount: number;
	/** Stride 9: x, u, y, height, radius, leanX, leanZ, yaw, tint */
	readonly birches: Float32Array;
	spruceCount: number;
	/** Stride 7: x, u, y, height, radius, yaw, tint */
	readonly spruces: Float32Array;
	poleCount: number;
	/** Stride 3: x, u, y */
	readonly poles: Float32Array;
}

export const BIRCH_STRIDE = 9;
export const SPRUCE_STRIDE = 7;
export const POLE_STRIDE = 3;

export function createChunkPlacementBuffer(): ChunkPlacementBuffer {
	return {
		birchCount: 0,
		birches: new Float32Array(MAX_BIRCHES_PER_CHUNK * BIRCH_STRIDE),
		spruceCount: 0,
		spruces: new Float32Array(MAX_SPRUCES_PER_CHUNK * SPRUCE_STRIDE),
		poleCount: 0,
		poles: new Float32Array(POLES_PER_CHUNK * POLE_STRIDE),
	};
}

interface BirchBand {
	readonly countPerSide: number;
	readonly minX: number;
	readonly maxX: number;
	readonly minHeight: number;
	readonly maxHeight: number;
	readonly minRadius: number;
	readonly maxRadius: number;
	readonly clusterChance: number;
}

const BIRCH_BANDS: readonly BirchBand[] = [
	// Foreground hero birches framing the snowy shoulder (clear of telegraph poles at x = 5.2).
	{
		countPerSide: 22,
		minX: 7.4,
		maxX: 20,
		minHeight: 11.0,
		maxHeight: 15.5,
		minRadius: 0.13,
		maxRadius: 0.19,
		clusterChance: 0.35,
	},
	// Denser midground birch forest.
	{
		countPerSide: 52,
		minX: 20,
		maxX: 62,
		minHeight: 10.5,
		maxHeight: 16.5,
		minRadius: 0.13,
		maxRadius: 0.2,
		clusterChance: 0.25,
	},
	// Deep background treeline fading into night fog.
	{
		countPerSide: 36,
		minX: 62,
		maxX: 145,
		minHeight: 11.5,
		maxHeight: 17.5,
		minRadius: 0.14,
		maxRadius: 0.22,
		clusterChance: 0.0,
	},
];

interface SpruceBand {
	readonly countPerSide: number;
	readonly minX: number;
	readonly maxX: number;
	readonly minHeight: number;
	readonly maxHeight: number;
	readonly minRadius: number;
	readonly maxRadius: number;
}

const SPRUCE_BANDS: readonly SpruceBand[] = [
	// Sparse slender dark spruces tucked behind the foreground birch trunks.
	{
		countPerSide: 10,
		minX: 24,
		maxX: 58,
		minHeight: 9.0,
		maxHeight: 15.0,
		minRadius: 1.15,
		maxRadius: 1.75,
	},
	// Deeper spruce silhouette wall behind the birches.
	{
		countPerSide: 24,
		minX: 54,
		maxX: 148,
		minHeight: 11.0,
		maxHeight: 18.0,
		minRadius: 1.5,
		maxRadius: 2.4,
	},
];

/**
 * Deterministically populates `out` for `(routeSeed, chunkIndex)` with zero heap allocations.
 */
export function fillChunkPlacements(
	routeSeed: number,
	chunkIndex: number,
	out: ChunkPlacementBuffer,
): void {
	const rand = mulberry32(chunkSeed(routeSeed, chunkIndex));

	let birchCount = 0;
	const birches = out.birches;

	for (const side of [-1, 1] as const) {
		for (const band of BIRCH_BANDS) {
			let placed = 0;
			let prevX = 0;
			let prevU = 0;
			let hasPrev = false;

			while (placed < band.countPerSide && birchCount < MAX_BIRCHES_PER_CHUNK) {
				let absX: number;
				let u: number;
				if (hasPrev && rand() < band.clusterChance) {
					// Natural birch twin/triple grove offset.
					const angle = rand() * Math.PI * 2;
					const dist = 0.65 + rand() * 1.45;
					absX = Math.max(
						band.minX,
						Math.min(band.maxX, prevX + Math.cos(angle) * dist),
					);
					u =
						(((prevU + Math.sin(angle) * dist) % CHUNK_LENGTH_M) +
							CHUNK_LENGTH_M) %
						CHUNK_LENGTH_M;
				} else {
					absX = band.minX + rand() * (band.maxX - band.minX);
					u = rand() * CHUNK_LENGTH_M;
				}

				prevX = absX;
				prevU = u;
				hasPrev = true;

				const x = side * absX;
				const y = terrainHeightAt(x, u) - 0.28;
				const height =
					band.minHeight + rand() * (band.maxHeight - band.minHeight);
				const radius =
					band.minRadius + rand() * (band.maxRadius - band.minRadius);
				const leanX = (rand() - 0.5) * 0.12;
				const leanZ = (rand() - 0.5) * 0.12;
				const yaw = rand() * Math.PI * 2;
				const tint = 0.84 + rand() * 0.24;

				const base = birchCount * BIRCH_STRIDE;
				birches[base] = x;
				birches[base + 1] = u;
				birches[base + 2] = y;
				birches[base + 3] = height;
				birches[base + 4] = radius;
				birches[base + 5] = leanX;
				birches[base + 6] = leanZ;
				birches[base + 7] = yaw;
				birches[base + 8] = tint;

				birchCount++;
				placed++;
			}
		}
	}
	out.birchCount = birchCount;

	let spruceCount = 0;
	const spruces = out.spruces;

	for (const side of [-1, 1] as const) {
		for (const band of SPRUCE_BANDS) {
			for (
				let i = 0;
				i < band.countPerSide && spruceCount < MAX_SPRUCES_PER_CHUNK;
				i++
			) {
				const absX = band.minX + rand() * (band.maxX - band.minX);
				const u = rand() * CHUNK_LENGTH_M;
				const x = side * absX;
				const y = terrainHeightAt(x, u) - 0.3;
				const height =
					band.minHeight + rand() * (band.maxHeight - band.minHeight);
				const radius =
					band.minRadius + rand() * (band.maxRadius - band.minRadius);
				const yaw = rand() * Math.PI * 2;
				const tint = 0.78 + rand() * 0.34;

				const base = spruceCount * SPRUCE_STRIDE;
				spruces[base] = x;
				spruces[base + 1] = u;
				spruces[base + 2] = y;
				spruces[base + 3] = height;
				spruces[base + 4] = radius;
				spruces[base + 5] = yaw;
				spruces[base + 6] = tint;

				spruceCount++;
			}
		}
	}
	out.spruceCount = spruceCount;

	// Telegraph poles at regular 40 m intervals on the +X window side.
	const poles = out.poles;
	for (let i = 0; i < POLES_PER_CHUNK; i++) {
		const u = (i + 0.5) * TELEGRAPH_POLE_SPACING_M;
		const x = TELEGRAPH_POLE_X;
		const y = terrainHeightAt(x, u) - 0.15;
		const base = i * POLE_STRIDE;
		poles[base] = x;
		poles[base + 1] = u;
		poles[base + 2] = y;
	}
	out.poleCount = POLES_PER_CHUNK;
}

/** Convenience allocating helper primarily for tests and inspection. */
export function generateChunkPlacements(
	routeSeed: number,
	chunkIndex: number,
): ChunkPlacementBuffer {
	const buffer = createChunkPlacementBuffer();
	fillChunkPlacements(routeSeed, chunkIndex, buffer);
	return buffer;
}
