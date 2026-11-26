import { dividerRight, slidingDoor, walkableLayout } from "./layout";

type Position = { x: number; z: number };
const slideSeconds = 0.42;

export function createDoor(clearance: number) {
	const paths = walkableLayout(clearance);
	let target = 0;
	let progress = 0;

	// Keep the doorway open while the capsule overlaps the sliding plane.
	function canToggle(at: Position) {
		const { gate } = paths;
		return (
			target === 0 ||
			at.x <= gate.minX ||
			at.x >= gate.maxX ||
			at.z < gate.minZ ||
			at.z > gate.maxZ
		);
	}

	return {
		x: dividerRight,
		z: (slidingDoor.start + slidingDoor.end) / 2,
		prompt(at: Position) {
			if (canToggle(at)) return target ? "Close door" : "Open door";
		},
		toggle(at: Position) {
			if (canToggle(at)) target = 1 - target;
		},
		get progress() {
			return progress;
		},
		get walkable() {
			return target === 1 && progress === 1 ? paths.open : paths.closed;
		},
		update(dt: number) {
			const delta = dt / slideSeconds;
			progress += Math.max(-delta, Math.min(delta, target - progress));
		},
	};
}
