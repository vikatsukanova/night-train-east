import { describe, expect, it } from "vitest";
import { chunkSeed, mulberry32 } from "../../src/core/rng";

describe("mulberry32", () => {
	it("repeats the same sequence for the same seed", () => {
		const first = mulberry32(42);
		const second = mulberry32(42);
		const other = mulberry32(43);

		expect(first()).toBe(0.6011037519201636);
		expect(second()).toBe(0.6011037519201636);
		for (let sample = 0; sample < 100; sample++) {
			const value = first();
			expect(value).toBe(second());
			expect(value).not.toBe(other());
			expect(value).toBeGreaterThanOrEqual(0);
			expect(value).toBeLessThan(1);
		}
	});
});

describe("chunkSeed", () => {
	it("mixes the route seed and signed chunk index independent of traversal order", () => {
		const indices = [-2, -1, 0, 1, 2];
		const seeds = indices.map((index) => chunkSeed(42, index));

		expect([...indices].reverse().map((index) => chunkSeed(42, index))).toEqual(
			[...seeds].reverse(),
		);
		expect(new Set(seeds).size).toBe(indices.length);
		expect(chunkSeed(42, -1)).not.toBe(chunkSeed(43, -1));
	});
});
