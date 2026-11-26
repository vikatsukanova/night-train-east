export type Point = { x: number; z: number };

// The train uses axis-aligned rectangular walkable polygons, already inset
// for the character's radius. Their union includes doorways and room interiors.
export type WalkablePolygon = {
	minX: number;
	maxX: number;
	minZ: number;
	maxZ: number;
};

function sweepAxis(
	start: number,
	end: number,
	across: number,
	polygons: readonly WalkablePolygon[],
	axis: "x" | "z",
) {
	const [min, max, crossMin, crossMax] =
		axis === "x"
			? (["minX", "maxX", "minZ", "maxZ"] as const)
			: (["minZ", "maxZ", "minX", "maxX"] as const);
	const forward = end > start;
	let reached = start;
	// Extend through every connected interval on the sweep line. Checking just
	// the destination would let a move jump across a closed gate or wall.
	for (let pass = 0; pass < polygons.length && reached !== end; pass++) {
		const previous = reached;
		for (const polygon of polygons) {
			if (
				across < polygon[crossMin] ||
				across > polygon[crossMax] ||
				reached < polygon[min] ||
				reached > polygon[max]
			)
				continue;
			reached = forward
				? Math.min(end, polygon[max])
				: Math.max(end, polygon[min]);
		}
		if (previous === reached) break;
	}
	return reached;
}

export function moveWithinWalkable(
	from: Point,
	delta: Point,
	polygons: readonly WalkablePolygon[],
): Point {
	const x = sweepAxis(from.x, from.x + delta.x, from.z, polygons, "x");
	const z = sweepAxis(from.z, from.z + delta.z, x, polygons, "z");
	return { x, z };
}
