import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from "three";
import { createDoor } from "./doors";
import {
	type Box,
	box,
	ceiling,
	compartments,
	counter,
	dividerLeft,
	dividerRight,
	doorBox,
	doorHeight,
	halfLength,
	halfWidth,
	innerEnd,
	innerWall,
	rectangle,
	roof,
	serviceOpening,
	sill,
	windowTop,
} from "./layout";

const unitBox = new BoxGeometry();
const wall = new MeshStandardMaterial({ color: 0xb98c65, roughness: 0.72 });
const wood = new MeshStandardMaterial({ color: 0x633d30, roughness: 0.64 });
const trim = new MeshStandardMaterial({ color: 0xa97846, roughness: 0.48 });
const floor = new MeshStandardMaterial({ color: 0x40302e });
const cream = new MeshStandardMaterial({ color: 0xc1a287 });
const fabric = new MeshStandardMaterial({ color: 0x42716d });
const lamp = new MeshStandardMaterial({
	color: 0xffd2a0,
	emissive: 0xffad61,
	emissiveIntensity: 1.15,
});

function place(mesh: Mesh, bounds: Box) {
	const { minX, maxX, minY, maxY, minZ, maxZ } = bounds;
	mesh.position.set((minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2);
	mesh.scale.set(maxX - minX, maxY - minY, maxZ - minZ);
}

export function createCarriage(clearance: number) {
	const group = new Group();
	const walls: Box[] = [];
	const door = createDoor(clearance);

	function add(material: MeshStandardMaterial, bounds: Box, solid = false) {
		const mesh = new Mesh(unitBox, material);
		place(mesh, bounds);
		group.add(mesh);
		if (solid) walls.push(bounds);
		return mesh;
	}

	const footprint = rectangle(-halfWidth, halfWidth, -halfLength, halfLength);
	add(floor, box(footprint, -0.16, 0), true);
	add(cream, box(footprint, ceiling, roof), true);

	function outerWall(
		x1: number,
		x2: number,
		trimX1: number,
		trimX2: number,
		windows: readonly { start: number; end: number }[],
	) {
		const length = rectangle(x1, x2, -halfLength, halfLength);
		add(wood, box(length, 0, sill));
		add(wall, box(length, windowTop, ceiling));
		// The clear window openings still stop the camera at the glass plane.
		walls.push(box(length, 0, ceiling));

		let edge = -halfLength;
		for (const { start, end } of windows) {
			add(wall, box(rectangle(x1, x2, edge, start), sill, windowTop));
			const frame = rectangle(trimX1, trimX2, start - 0.035, end + 0.035);
			add(trim, box(frame, sill - 0.04, sill + 0.025), true);
			add(trim, box(frame, windowTop - 0.025, windowTop + 0.04), true);
			edge = end;
		}
		add(wall, box(rectangle(x1, x2, edge, halfLength), sill, windowTop));
	}

	outerWall(
		-halfWidth,
		-innerWall,
		-innerWall,
		-innerWall + 0.025,
		compartments.map(({ window }) => window),
	);
	outerWall(
		innerWall,
		halfWidth,
		innerWall - 0.025,
		innerWall,
		Array.from({ length: 10 }, (_, i) => ({
			start: -10.7 + i * 2.25,
			end: -9.09 + i * 2.25,
		})),
	);

	for (const end of [-1, 1]) {
		const [z1, z2] =
			end < 0 ? [-halfLength, -innerEnd] : [innerEnd, halfLength];
		const endDoorLeft = 0.51;
		const endDoorRight = 1.35;
		add(
			wall,
			box(rectangle(-innerWall, endDoorLeft, z1, z2), 0, ceiling),
			true,
		);
		add(
			wall,
			box(rectangle(endDoorRight, innerWall, z1, z2), 0, ceiling),
			true,
		);
		const endDoor = rectangle(endDoorLeft, endDoorRight, z1, z2);
		add(wood, box(endDoor, 0, doorHeight), true);
		add(wall, box(endDoor, doorHeight, ceiling), true);
		const front = -end * 0.025;
		add(
			trim,
			box(rectangle(0.6, 0.72, z1 + front, z2 + front), 1.02, 1.08),
			true,
		);
	}

	function divider(z1: number, z2: number, y = 0) {
		add(
			wood,
			box(rectangle(dividerLeft, dividerRight, z1, z2), y, ceiling),
			true,
		);
	}
	divider(-innerEnd, serviceOpening.start);
	divider(serviceOpening.start, serviceOpening.end, doorHeight);
	let edge = serviceOpening.end;
	for (const { start, end, opening, bunks, table } of compartments) {
		add(
			wall,
			box(
				rectangle(-innerWall, dividerLeft, start - 0.055, start + 0.055),
				0,
				ceiling,
			),
			true,
		);
		divider(edge, opening.start);
		divider(opening.start, opening.end, doorHeight);
		edge = opening.end;

		for (const height of [0.45, 1.57]) {
			add(wood, box(bunks, height - 0.1, height), true);
			add(fabric, box(bunks, height, height + 0.12), true);
		}
		add(wood, box(table, 0.74, 0.81), true);
		add(
			trim,
			box(rectangle(-1.39, -1.27, table.minZ, table.maxZ), 0.1, 0.74),
			true,
		);
		add(
			lamp,
			box(
				rectangle(-0.73, -0.22, end - 1.16, end - 1.08),
				ceiling - 0.06,
				ceiling,
			),
		);
	}
	const last = compartments.at(-1);
	if (last) {
		add(
			wall,
			box(
				rectangle(-innerWall, dividerLeft, last.end - 0.055, last.end + 0.055),
				0,
				ceiling,
			),
			true,
		);
	}
	divider(edge, innerEnd);

	// Service niche recessed behind the corridor-side panel.
	add(wood, box(counter, 0, 0.95), true);
	add(trim, box(rectangle(-0.84, -0.51, -7.35, -7.01), 0.95, 1.36), true);
	add(cream, box(rectangle(-0.77, -0.58, -7.28, -7.08), 1.36, 1.43), true);
	for (let z = -10.5; z < innerEnd; z += 3) {
		add(lamp, box(rectangle(0.85, 1.05, z, z + 1.1), ceiling - 0.05, ceiling));
	}

	const leaf = add(wall, doorBox(0));
	const pull = new Mesh(unitBox, trim);
	pull.scale.set(0.017, 0.16, 0.055);
	group.add(pull);
	let previousProgress = door.progress;
	const colliders = [...walls, doorBox(0)];
	const renderColliders = [...colliders];

	return {
		group,
		door,
		colliders,
		update(dt: number) {
			previousProgress = door.progress;
			door.update(dt);
			if (door.progress !== previousProgress)
				colliders[walls.length] = doorBox(door.progress);
		},
		render(alpha: number) {
			const bounds = doorBox(
				previousProgress + (door.progress - previousProgress) * alpha,
			);
			place(leaf, bounds);
			pull.position.set(bounds.maxX + 0.007, 1.08, bounds.minZ + 0.12);
			renderColliders[walls.length] = bounds;
			return renderColliders;
		},
	};
}
