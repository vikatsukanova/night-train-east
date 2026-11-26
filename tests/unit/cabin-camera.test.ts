import { MathUtils, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import {
	createCabinCamera,
	dampLook,
	pointerLook,
} from "../../src/render/cabinCamera";

describe("cabin camera", () => {
	it("clamps pointer offsets and maps right/up to right/up", () => {
		const upperRight = pointerLook(3, -2);
		expect(MathUtils.radToDeg(upperRight.yaw)).toBeCloseTo(-25);
		expect(MathUtils.radToDeg(upperRight.pitch)).toBeCloseTo(12);
		const lowerLeft = pointerLook(-3, 2);
		expect(MathUtils.radToDeg(lowerLeft.yaw)).toBeCloseTo(25);
		expect(MathUtils.radToDeg(lowerLeft.pitch)).toBeCloseTo(-12);
		expect(pointerLook(0, 0).yaw).toBeCloseTo(0);
		expect(pointerLook(0, 0).pitch).toBeCloseTo(0);
	});

	it("eases towards the target independently of the time step", () => {
		const centre = { yaw: 0, pitch: 0 };
		const target = pointerLook(1, 1);
		const single = dampLook(centre, target, 0.3);
		const multiple = dampLook(dampLook(centre, target, 0.1), target, 0.2);
		expect(single.yaw).toBeCloseTo(multiple.yaw, 12);
		expect(single.pitch).toBeCloseTo(multiple.pitch, 12);
		expect(Math.abs(single.yaw)).toBeLessThan(Math.abs(target.yaw));
	});

	const position = new Vector3(0.25, 1.16, -4.1);
	const focus = new Vector3(-1.43, 1.08, -4.36);

	it("starts aimed at the window and only rotates when the pointer moves", () => {
		const cabin = createCabinCamera(position, focus, 800);
		const direction = cabin.camera.getWorldDirection(new Vector3());
		expect(direction.angleTo(focus.clone().sub(position))).toBeCloseTo(0);

		cabin.aim(1, -1);
		cabin.update(0.2);
		cabin.render(1);
		const aimed = cabin.camera.getWorldDirection(new Vector3());
		expect(aimed.z).toBeLessThan(direction.z);
		expect(aimed.y).toBeGreaterThan(direction.y);
		expect(cabin.camera.position).toEqual(position);
	});

	it("returns to centre on release or after the pointer goes idle", () => {
		const released = createCabinCamera(position, focus, 800);
		const idle = createCabinCamera(position, focus, 800);
		const centre = idle.camera.rotation.y;
		for (const cabin of [released, idle]) {
			cabin.aim(1, 0);
			cabin.update(0.2);
			cabin.render(1);
			expect(cabin.camera.rotation.y).toBeLessThan(centre);
		}

		released.release();
		released.update(0.6);
		idle.update(0.6);
		released.render(1);
		idle.render(1);
		expect(released.camera.rotation.y).toBeGreaterThan(idle.camera.rotation.y);

		idle.update(2);
		idle.render(1);
		expect(idle.camera.rotation.y).toBeCloseTo(centre, 5);
	});
});
