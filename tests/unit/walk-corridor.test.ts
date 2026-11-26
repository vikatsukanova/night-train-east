import { describe, expect, it } from "vitest";
import { boomLimit, createCameraRig } from "../../src/player/cameraRig";
import { moveWithinWalkable } from "../../src/player/collision";
import {
	createController,
	movementDirection,
} from "../../src/player/controller";
import { nearestInteractable } from "../../src/player/interact";
import { createCarriage } from "../../src/train/carriage";
import { createDoor } from "../../src/train/doors";
import {
	dividerRight,
	halfLength,
	innerWall,
	slidingDoor,
	spawn,
	walkableLayout,
} from "../../src/train/layout";

const radius = 0.22;
const doorwayZ = (slidingDoor.start + slidingDoor.end) / 2;
const atDoor = { x: spawn.x, z: doorwayZ };

describe("walkable polygons", () => {
	it("slides along the corridor wall and stops at the end with capsule clearance", () => {
		const { closed } = walkableLayout(radius);
		expect(moveWithinWalkable(spawn, { x: 3, z: 2 }, closed)).toEqual({
			x: innerWall - radius,
			z: spawn.z + 2,
		});
		expect(moveWithinWalkable(spawn, { x: 0, z: -100 }, closed).z).toBeCloseTo(
			-halfLength + 0.14 + radius,
		);
	});

	it("blocks crossing a closed gate and allows a sweep through the open doorway", () => {
		const { closed, open } = walkableLayout(radius);
		expect(moveWithinWalkable(atDoor, { x: -2, z: 0 }, closed).x).toBeCloseTo(
			dividerRight + radius,
		);
		expect(moveWithinWalkable(atDoor, { x: -2, z: 0 }, open).x).toBeLessThan(0);
	});

	it("opens the walkable gate once the leaf clears it and refuses to close on the capsule", () => {
		const door = createDoor(radius);
		const closed = door.walkable;
		expect(door.prompt(atDoor)).toBe("Open door");
		door.toggle(atDoor);
		expect(door.prompt(atDoor)).toBe("Close door");
		door.update(0.2);
		expect(door.progress).toBeGreaterThan(0);
		expect(door.walkable).toBe(closed);
		door.update(0.3);
		expect(door.walkable).not.toBe(closed);
		const inDoorway = { x: dividerRight, z: doorwayZ };
		expect(door.prompt(inDoorway)).toBeUndefined();
		door.toggle(inDoorway);
		expect(door.prompt(atDoor)).toBe("Close door");
		door.toggle(atDoor);
		expect(door.walkable).toBe(closed);
		door.update(0.5);
		expect(door.progress).toBe(0);
	});
});

describe("camera collision", () => {
	it("stays inside the window plane and corridor divider as orbit swings back into either wall", () => {
		const train = createCarriage(radius);
		for (const turn of [-1, 1]) {
			const rig = createCameraRig();
			rig.update(
				1 / 60,
				(turn * (Math.PI / 2)) / 0.0024,
				0,
				spawn,
				train.colliders,
			);
			for (const alpha of [0, 0.25, 0.5, 0.75, 1]) {
				rig.render(alpha, spawn, train.render(alpha));
				expect(rig.camera.position.x).toBeLessThanOrEqual(innerWall - 0.12);
				expect(rig.camera.position.x).toBeGreaterThanOrEqual(
					dividerRight + 0.12,
				);
			}
		}
	});

	it("clips the boom against the actual sliding leaf and clears it once open", () => {
		const train = createCarriage(radius);
		const origin = { ...atDoor, y: 1.43 };
		const offset = { x: -1, y: 0, z: 0 };
		expect(boomLimit(origin, offset, train.colliders)).toBeLessThan(0.5);
		train.door.toggle(atDoor);
		train.update(0.5);
		expect(boomLimit(origin, offset, train.render(0))).toBeLessThan(0.5);
		expect(boomLimit(origin, offset, train.render(1))).toBe(1);
	});
});

describe("movement and interaction", () => {
	it("rotates normalized WASD input by camera yaw", () => {
		const forward = { forward: 1, right: 0, fast: false };
		expect(movementDirection(forward, 0).z).toBe(-1);
		expect(movementDirection(forward, Math.PI / 2).x).toBeCloseTo(-1);
		const diagonal = movementDirection({ ...forward, right: 1 }, 0);
		expect(diagonal.x).toBeCloseTo(Math.SQRT1_2);
		expect(diagonal.z).toBeCloseTo(-Math.SQRT1_2);
	});

	it("uses walk and stroll speeds and turns toward the intended movement", () => {
		const paths = walkableLayout(radius).closed;
		const player = createController(spawn);
		player.update(0.25, { forward: -1, right: 0, fast: false }, 0, paths);
		expect(player.state.z - spawn.z).toBeCloseTo(1.4 * 0.25);
		expect(Math.abs(player.state.yaw)).toBeGreaterThan(Math.PI / 2);
		const previousZ = player.state.z;
		player.update(0.25, { forward: -1, right: 0, fast: true }, 0, paths);
		expect(player.state.z - previousZ).toBeCloseTo(2.2 * 0.25);
	});

	it("offers the closest interactable in front and in reach", () => {
		const door = createDoor(radius);
		const fartherDoor = { ...door, x: door.x - 0.3 };
		expect(nearestInteractable(atDoor, Math.PI / 2, [fartherDoor, door])).toBe(
			door,
		);
		expect(nearestInteractable(atDoor, -Math.PI / 2, [door])).toBeUndefined();
		expect(
			nearestInteractable({ ...atDoor, z: doorwayZ + 2 }, 0, [door]),
		).toBeUndefined();
	});
});
