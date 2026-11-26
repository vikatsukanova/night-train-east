import { MathUtils, PerspectiveCamera } from "three";

type Point = { readonly x: number; readonly y: number; readonly z: number };
type Look = { readonly yaw: number; readonly pitch: number };

const CENTRE: Look = { yaw: 0, pitch: 0 };
const MAX_YAW = MathUtils.degToRad(25);
const MAX_PITCH = MathUtils.degToRad(12);
const IDLE_SECONDS = 0.8;
const DAMPING_PER_SECOND = 6;

export function pointerLook(x: number, y: number): Look {
	// Browser coordinates increase downwards, and positive yaw turns left.
	return {
		yaw: -MathUtils.clamp(x, -1, 1) * MAX_YAW,
		pitch: -MathUtils.clamp(y, -1, 1) * MAX_PITCH,
	};
}

export function dampLook(current: Look, target: Look, dt: number): Look {
	const weight = -Math.expm1(-DAMPING_PER_SECOND * dt);
	return {
		yaw: MathUtils.lerp(current.yaw, target.yaw, weight),
		pitch: MathUtils.lerp(current.pitch, target.pitch, weight),
	};
}

export function createCabinCamera(position: Point, focus: Point, far: number) {
	const camera = new PerspectiveCamera(50, 1, 0.05, far);
	camera.position.set(position.x, position.y, position.z);
	camera.rotation.order = "YXZ";
	camera.lookAt(focus.x, focus.y, focus.z);
	const centreYaw = camera.rotation.y;
	const centrePitch = camera.rotation.x;
	let previous = CENTRE;
	let current = CENTRE;
	let target = CENTRE;
	let idleRemaining = 0;

	return {
		camera,
		aim(x: number, y: number) {
			target = pointerLook(x, y);
			idleRemaining = IDLE_SECONDS;
		},
		release() {
			idleRemaining = 0;
		},
		update(dt: number) {
			previous = current;
			// Split at the idle deadline so damping stays consistent across step sizes.
			const activeDt = Math.min(dt, idleRemaining);
			idleRemaining -= activeDt;
			current = dampLook(
				dampLook(current, target, activeDt),
				CENTRE,
				dt - activeDt,
			);
		},
		render(alpha: number) {
			camera.rotation.y =
				centreYaw + MathUtils.lerp(previous.yaw, current.yaw, alpha);
			camera.rotation.x =
				centrePitch + MathUtils.lerp(previous.pitch, current.pitch, alpha);
		},
	};
}
