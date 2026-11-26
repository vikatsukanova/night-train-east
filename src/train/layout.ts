type Bounds = {
	minX: number;
	maxX: number;
	minZ: number;
	maxZ: number;
};

export type Box = Bounds & { minY: number; maxY: number };

export function rectangle(
	minX: number,
	maxX: number,
	minZ: number,
	maxZ: number,
): Bounds {
	return { minX, maxX, minZ, maxZ };
}

export function box(bounds: Bounds, minY: number, maxY: number): Box {
	return { ...bounds, minY, maxY };
}

export const halfWidth = 1.55;
export const halfLength = 12;
export const roof = 2.9;
export const ceiling = roof - 0.12;
export const innerWall = halfWidth - 0.12;
export const innerEnd = halfLength - 0.14;
export const dividerLeft = 0.32;
export const dividerRight = 0.43;
export const doorHeight = 2.1;
export const sill = 0.95;
export const windowTop = 1.85;
export const serviceOpening = { start: -7.48, end: -5.55 };
export const counter = rectangle(-1.42, 0.31, -7.48, -6.91);
export const spawn = { x: (innerWall + dividerRight) / 2, z: -2.8 };

export const compartments = Array.from({ length: 4 }, (_, index) => {
	const start = -5.3 + index * 2.25;
	const end = start + 2.25;
	const middle = (start + end) / 2;
	return {
		start,
		end,
		opening: { start: middle - 0.44, end: middle + 0.44 },
		window: { start: middle - 0.72, end: middle + 0.72 },
		bunks: rectangle(-innerWall, dividerLeft, end - 0.54, end - 0.055),
		table: rectangle(-innerWall, -0.94, middle - 0.24, middle + 0.24),
	};
});
const firstRoom = compartments[0];
if (!firstRoom) throw new Error("Missing compartment layout.");

export const slidingDoor = firstRoom.opening;
export const doorTravel = slidingDoor.end - slidingDoor.start + 0.025;

export function doorBox(progress: number) {
	const offset = progress * doorTravel;
	return box(
		rectangle(
			dividerRight - 0.06,
			dividerRight - 0.02,
			slidingDoor.start + offset,
			slidingDoor.end + offset,
		),
		0,
		doorHeight,
	);
}

export function walkableLayout(clearance: number) {
	// Each rectangle is a walkable polygon for the capsule centre. Doorway
	// polygons overlap the room and corridor at the edge of their wall clearance.
	const corridor = rectangle(
		dividerRight + clearance,
		innerWall - clearance,
		-innerEnd + clearance,
		innerEnd - clearance,
	);

	const paths = [
		corridor,
		rectangle(
			-innerWall + clearance,
			corridor.minX,
			counter.maxZ + clearance,
			serviceOpening.end - clearance,
		),
	];
	const gates: Bounds[] = [];
	for (const { start, opening, bunks, table } of compartments) {
		const roomLeft = -innerWall + clearance;
		const roomRight = dividerLeft - clearance;
		const roomStart = start + 0.055 + clearance;
		const roomEnd = bunks.minZ - clearance;
		paths.push(
			rectangle(table.maxX + clearance, roomRight, roomStart, roomEnd),
			rectangle(roomLeft, roomRight, roomStart, table.minZ - clearance),
		);
		gates.push(
			rectangle(
				roomRight,
				corridor.minX,
				opening.start + clearance,
				opening.end - clearance,
			),
		);
	}

	const [gate, ...openGates] = gates;
	if (!gate) throw new Error("Missing sliding door gate.");
	const closed = [...paths, ...openGates];
	return { closed, open: [...closed, gate], gate };
}
