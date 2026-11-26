import { describe, expect, it } from "vitest";
import {
	BIRCH_STRIDE,
	createChunkPlacementBuffer,
	fillChunkPlacements,
	generateChunkPlacements,
	POLE_STRIDE,
	SCENERY_CLEARANCE_X,
	SPRUCE_STRIDE,
	terrainHeightAt,
} from "../../src/world/scenery/birchLayout";
import {
	activeChunkIndices,
	CHUNK_LENGTH_M,
	CHUNKS_AHEAD,
	CHUNKS_BEHIND,
	chunkIndexAtDistance,
	chunkRingSlot,
	chunkWorldZ,
	isChunkVisibleInFog,
	RING_SIZE,
} from "../../src/world/scenery/chunkMath";

describe("chunkMath", () => {
	it("maps distance to global chunk indices and contiguous non-duplicate active windows", () => {
		expect(chunkIndexAtDistance(0)).toBe(0);
		expect(chunkIndexAtDistance(79.99)).toBe(0);
		expect(chunkIndexAtDistance(80)).toBe(1);
		expect(chunkIndexAtDistance(-1)).toBe(-1);

		for (const distanceM of [0, 39.5, 80, 1234.5, 25_000]) {
			const indices = activeChunkIndices(distanceM);
			expect(indices).toHaveLength(RING_SIZE);
			expect(new Set(indices).size).toBe(RING_SIZE);

			const base = chunkIndexAtDistance(distanceM);
			expect(indices[0]).toBe(base - CHUNKS_BEHIND);
			expect(indices[indices.length - 1]).toBe(base + CHUNKS_AHEAD - 1);

			// Consecutive indices with no gaps.
			for (let i = 1; i < indices.length; i++) {
				expect((indices[i] ?? 0) - (indices[i - 1] ?? 0)).toBe(1);
			}

			// Ring slots form a bijection onto [0, RING_SIZE).
			const slots = indices.map(chunkRingSlot);
			expect(new Set(slots).size).toBe(RING_SIZE);
			for (const slot of slots) {
				expect(slot).toBeGreaterThanOrEqual(0);
				expect(slot).toBeLessThan(RING_SIZE);
			}
		}
	});

	it("recycles exactly one slot per chunk boundary crossed and moves chunks toward +Z", () => {
		const before = activeChunkIndices(79.9);
		const after = activeChunkIndices(80.1);

		const dropped = before.filter((idx) => !after.includes(idx));
		const added = after.filter((idx) => !before.includes(idx));
		expect(dropped).toHaveLength(1);
		expect(added).toHaveLength(1);
		// The newly entering chunk reuses the exact ring slot vacated by the leaving chunk.
		expect(chunkRingSlot(added[0] ?? 0)).toBe(chunkRingSlot(dropped[0] ?? 0));

		// As distance grows, a chunk's world Z increases (moves toward +Z).
		expect(chunkWorldZ(3, 100)).toBeGreaterThan(chunkWorldZ(3, 0));
		expect(chunkWorldZ(0, 0)).toBeCloseTo(0, 6);
		expect(chunkWorldZ(1, 0)).toBeCloseTo(-CHUNK_LENGTH_M, 6);
		expect(chunkWorldZ(-1, 0)).toBeCloseTo(CHUNK_LENGTH_M, 6);
	});

	it("culls chunks beyond fog visibility distance", () => {
		expect(isChunkVisibleInFog(0, 0, 300)).toBe(true);
		expect(isChunkVisibleInFog(3, 0, 300)).toBe(true); // [-320, -240] -> nearest edge 240 <= 300
		expect(isChunkVisibleInFog(5, 0, 300)).toBe(false); // [-480, -400] -> nearest edge 400 > 300
		expect(isChunkVisibleInFog(-2, 0, 300)).toBe(true); // [+80, +160] -> nearest edge 80 <= 300
	});
});

describe("birchLayout", () => {
	it("produces identical placements for a given seed and chunk index regardless of visit order", () => {
		const routeSeed = 1986;
		const indices = [-2, 0, 7, 42, 315];
		const forward = indices.map((idx) =>
			generateChunkPlacements(routeSeed, idx),
		);

		// Visit in reverse order, reusing a single pre-allocated scratch buffer.
		const scratch = createChunkPlacementBuffer();
		for (let i = indices.length - 1; i >= 0; i--) {
			const idx = indices[i] ?? 0;
			fillChunkPlacements(routeSeed, idx, scratch);
			const expected = forward[i];
			expect(expected).toBeDefined();
			expect(scratch.birchCount).toBe(expected?.birchCount);
			expect(scratch.spruceCount).toBe(expected?.spruceCount);
			expect(scratch.poleCount).toBe(expected?.poleCount);
			expect(Array.from(scratch.birches)).toEqual(
				Array.from(expected?.birches ?? []),
			);
			expect(Array.from(scratch.spruces)).toEqual(
				Array.from(expected?.spruces ?? []),
			);
			expect(Array.from(scratch.poles)).toEqual(
				Array.from(expected?.poles ?? []),
			);
		}

		// Different chunks and different seeds produce different forests.
		const nextChunk = generateChunkPlacements(routeSeed, 1);
		const otherSeed = generateChunkPlacements(routeSeed + 1, 0);
		expect(Array.from(forward[1]?.birches ?? [])).not.toEqual(
			Array.from(nextChunk.birches),
		);
		expect(Array.from(forward[1]?.birches ?? [])).not.toEqual(
			Array.from(otherSeed.birches),
		);
	});

	it("keeps all scenery outside the |x| < 2.2 m train clearance envelope and stitches terrain seams", () => {
		const layout = generateChunkPlacements(1986, 12);

		for (let i = 0; i < layout.birchCount; i++) {
			const x = layout.birches[i * BIRCH_STRIDE] ?? 0;
			expect(Math.abs(x)).toBeGreaterThanOrEqual(SCENERY_CLEARANCE_X);
		}
		for (let i = 0; i < layout.spruceCount; i++) {
			const x = layout.spruces[i * SPRUCE_STRIDE] ?? 0;
			expect(Math.abs(x)).toBeGreaterThanOrEqual(SCENERY_CLEARANCE_X);
		}
		for (let i = 0; i < layout.poleCount; i++) {
			const x = layout.poles[i * POLE_STRIDE] ?? 0;
			expect(Math.abs(x)).toBeGreaterThanOrEqual(SCENERY_CLEARANCE_X);
		}

		// Adjacent chunks must match terrain height identically along the seam.
		for (const x of [-120, -35, -8, -3, 0, 3, 8, 35, 120]) {
			expect(terrainHeightAt(x, 0)).toBeCloseTo(
				terrainHeightAt(x, CHUNK_LENGTH_M),
				6,
			);
		}
	});
});
