import { PerspectiveCamera, Vector3 } from "three";
import type { Point } from "./collision";

type Position = Point & { y: number };
export type CameraBox = {
	minX: number;
	maxX: number;
	minY: number;
	maxY: number;
	minZ: number;
	maxZ: number;
};

const axes = [
	["x", "minX", "maxX"],
	["y", "minY", "maxY"],
	["z", "minZ", "maxZ"],
] as const;

const near = 0.04;
// Covers the near-plane corners, with room for unusually wide viewports.
export const cameraRadius = 0.12;

export function boomLimit(
	origin: Position,
	offset: Position,
	boxes: readonly CameraBox[],
	radius = cameraRadius,
) {
	let limit = 1;
	for (const box of boxes) {
		let entry = 0;
		let exit = limit;
		for (const [axis, min, max] of axes) {
			const lower = box[min] - radius - origin[axis];
			const upper = box[max] + radius - origin[axis];
			const velocity = offset[axis];
			if (Math.abs(velocity) < 1e-8) {
				if (lower > 0 || upper < 0) {
					entry = Infinity;
					break;
				}
				continue;
			}
			entry = Math.max(entry, Math.min(lower / velocity, upper / velocity));
			exit = Math.min(exit, Math.max(lower / velocity, upper / velocity));
			if (entry > exit) break;
		}
		if (entry <= exit) limit = Math.max(0, entry - 0.001);
	}
	return limit;
}

const shoulder = 0.25;
const boom = 2.1;
const pivotY = 1.43;
const sensitivity = 0.0024;

export function createCameraRig() {
	const camera = new PerspectiveCamera(59, 1, near, 100);
	const pivot = new Vector3();
	const offset = new Vector3();
	const sight = new Vector3();

	let yaw = 0;
	let pitch = 0.27;
	let previousYaw = yaw;
	let previousPitch = pitch;
	let extension = 1;
	let previousExtension = extension;

	function setBoom(position: Point, yaw: number, pitch: number) {
		const sin = Math.sin(yaw);
		const cos = Math.cos(yaw);
		const horizontal = boom * Math.cos(pitch);
		pivot.set(position.x, pivotY, position.z);
		offset.set(
			sin * horizontal + cos * shoulder,
			boom * Math.sin(pitch),
			cos * horizontal - sin * shoulder,
		);
	}

	function radius() {
		return Math.max(
			cameraRadius,
			near *
				Math.hypot(
					1,
					Math.tan((camera.fov * Math.PI) / 360) * Math.hypot(1, camera.aspect),
				),
		);
	}

	return {
		camera,
		get yaw() {
			return yaw;
		},
		update(
			dt: number,
			dx: number,
			dy: number,
			position: Point,
			boxes: readonly CameraBox[],
		) {
			previousYaw = yaw;
			previousPitch = pitch;
			previousExtension = extension;
			yaw -= dx * sensitivity;
			pitch = Math.max(-0.38, Math.min(0.58, pitch + dy * sensitivity));

			setBoom(position, yaw, pitch);
			// Ease toward a small stand-off zone before reaching the hard limit.
			const target = boomLimit(pivot, offset, boxes, radius() + 0.05);
			extension +=
				(target - extension) *
				(1 - Math.exp(-(target < extension ? 26 : 8) * dt));
		},
		render(alpha: number, position: Point, boxes: readonly CameraBox[]) {
			const viewYaw = previousYaw + (yaw - previousYaw) * alpha;
			const viewPitch = previousPitch + (pitch - previousPitch) * alpha;
			setBoom(position, viewYaw, viewPitch);
			const smoothed =
				previousExtension + (extension - previousExtension) * alpha;
			// Recast at the rendered pose so interpolation cannot cross a wall.
			const safe = Math.min(
				smoothed,
				boomLimit(pivot, offset, boxes, radius()),
			);
			camera.position.copy(pivot).addScaledVector(offset, safe);

			sight.set(
				-Math.sin(viewYaw) * Math.cos(viewPitch),
				-Math.sin(viewPitch),
				-Math.cos(viewYaw) * Math.cos(viewPitch),
			);
			camera.lookAt(sight.add(camera.position));
		},
	};
}
