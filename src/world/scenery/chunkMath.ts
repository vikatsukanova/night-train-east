export const CHUNK_LENGTH_M = 80;
export const CHUNKS_BEHIND = 2;
export const CHUNKS_AHEAD = 8;
export const RING_SIZE = CHUNKS_BEHIND + CHUNKS_AHEAD;

/** Global chunk index containing `distanceM` (chunk k spans [k * 80, (k + 1) * 80)). */
export function chunkIndexAtDistance(distanceM: number): number {
	return Math.floor(distanceM / CHUNK_LENGTH_M);
}

/**
 * Active global chunk indices around `distanceM`, ordered from furthest behind (+Z)
 * to furthest ahead (-Z). Covers roughly [-640 m, +160 m] around the train.
 */
export function activeChunkIndices(
	distanceM: number,
	target?: number[],
): number[] {
	const base = chunkIndexAtDistance(distanceM);
	const out = target ?? new Array<number>(RING_SIZE);
	out.length = RING_SIZE;
	for (let i = 0; i < RING_SIZE; i++) {
		out[i] = base - CHUNKS_BEHIND + i;
	}
	return out;
}

/** Deterministic ring-buffer slot in [0, RING_SIZE) for any signed global chunk index. */
export function chunkRingSlot(chunkIndex: number): number {
	return ((chunkIndex % RING_SIZE) + RING_SIZE) % RING_SIZE;
}

/** Route start distance (m) of chunk `chunkIndex`. */
export function chunkStartDistanceM(chunkIndex: number): number {
	return chunkIndex * CHUNK_LENGTH_M;
}

/**
 * World Z coordinate of the chunk's `u = 0` origin.
 * Train faces -Z; scenery moves toward +Z as `distanceM` grows:
 *   z = -(chunkStart - distance) = distance - chunkStart
 * Points inside the chunk at route offset u in [0, 80) lie at worldZ = chunkWorldZ - u.
 */
export function chunkWorldZ(chunkIndex: number, distanceM: number): number {
	return -(chunkStartDistanceM(chunkIndex) - distanceM);
}

/**
 * Returns true if any part of chunk `chunkIndex` lies within `fogCutoffM` metres of the train
 * along Z. Chunks occupy world Z in [chunkWorldZ - CHUNK_LENGTH_M, chunkWorldZ].
 */
export function isChunkVisibleInFog(
	chunkIndex: number,
	distanceM: number,
	fogCutoffM: number,
): boolean {
	const zMax = chunkWorldZ(chunkIndex, distanceM);
	const zMin = zMax - CHUNK_LENGTH_M;
	// Distance from train origin (z = 0) to the chunk's Z interval [zMin, zMax].
	const nearestAbsZ = zMax < 0 ? -zMax : Math.max(zMin, 0);
	return nearestAbsZ <= fogCutoffM;
}
