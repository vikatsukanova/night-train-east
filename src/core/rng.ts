export function mulberry32(seed: number): () => number {
	let state = seed >>> 0;

	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let value = Math.imul(state ^ (state >>> 15), state | 1);
		value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
		return ((value ^ (value >>> 14)) >>> 0) / 0x1_0000_0000;
	};
}

/** Mix the route seed and signed chunk index as 32-bit integers. */
export function chunkSeed(routeSeed: number, chunkIndex: number): number {
	let hash = routeSeed ^ Math.imul(chunkIndex, 0x9e3779b9);
	hash = Math.imul(hash ^ (hash >>> 16), 0x85ebca6b);
	hash = Math.imul(hash ^ (hash >>> 13), 0xc2b2ae35);
	return (hash ^ (hash >>> 16)) >>> 0;
}
