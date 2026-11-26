import {
	moveWithinWalkable,
	type Point,
	type WalkablePolygon,
} from "./collision";

export type Movement = {
	forward: number;
	right: number;
	fast: boolean;
};

export function movementDirection(
	{ forward, right }: Movement,
	yaw: number,
): Point {
	const length = Math.hypot(forward, right) || 1;
	const sin = Math.sin(yaw);
	const cos = Math.cos(yaw);
	return {
		x: (right * cos - forward * sin) / length,
		z: (-right * sin - forward * cos) / length,
	};
}

export function angleDifference(from: number, to: number) {
	return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

export function createController(spawn: Point) {
	let current = { ...spawn, yaw: 0 };
	let previous = current;

	return {
		get state() {
			return current;
		},
		update(
			dt: number,
			input: Movement,
			cameraYaw: number,
			walkable: readonly WalkablePolygon[],
		) {
			previous = current;
			const direction = movementDirection(input, cameraYaw);
			if (direction.x === 0 && direction.z === 0) return;

			const distance = (input.fast ? 2.2 : 1.4) * dt;
			const position = moveWithinWalkable(
				current,
				{ x: direction.x * distance, z: direction.z * distance },
				walkable,
			);
			const targetYaw = Math.atan2(-direction.x, -direction.z);
			const yaw =
				current.yaw +
				angleDifference(current.yaw, targetYaw) * (1 - Math.exp(-13 * dt));
			current = { ...position, yaw };
		},
		sample(alpha: number) {
			return {
				x: previous.x + (current.x - previous.x) * alpha,
				z: previous.z + (current.z - previous.z) * alpha,
				yaw: previous.yaw + (current.yaw - previous.yaw) * alpha,
			};
		},
	};
}
