import { Raycaster, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { createCabinCamera } from "../../src/render/cabinCamera";
import { createCompartment } from "../../src/train/compartment";
import {
	compartmentSeat,
	compartmentView,
	compartmentLayout as layout,
} from "../../src/train/compartmentLayout";
import { innerWall } from "../../src/train/layout";

function point({ x, y, z }: { x: number; y: number; z: number }) {
	return new Vector3(x, y, z);
}

describe("M1 compartment", () => {
	it("frames the window above centre between the facing berths", () => {
		const { eye, focus } = compartmentView;
		const { camera } = createCabinCamera(eye, focus, 800);
		camera.aspect = 1280 / 720;
		camera.updateProjectionMatrix();
		camera.updateMatrixWorld();

		const windowCentre = new Vector3(
			layout.window.x,
			(layout.window.bottom + layout.window.top) / 2,
			layout.window.centreZ,
		);
		const windowInFrame = windowCentre.project(camera);
		expect(Math.abs(windowInFrame.x)).toBeLessThan(0.2);
		expect(windowInFrame.y).toBeGreaterThan(0.15);
		expect(windowInFrame.y).toBeLessThan(0.45);
		expect(eye.x).toBeGreaterThan(layout.rightBerth.maxX);
		expect(eye.x).toBeLessThan(layout.doorX);
		expect(eye.y).toBeGreaterThanOrEqual(1.3);
		expect(eye.y).toBeLessThanOrEqual(1.4);

		expect(point(compartmentSeat).project(camera).x).toBeGreaterThan(0.2);
		expect(compartmentSeat.z).toBeGreaterThan(layout.rightBerth.minZ);
		expect(compartmentSeat.z).toBeLessThan(layout.rightBerth.maxZ);
		const leftBerthCentreZ =
			(layout.leftBerth.minZ + layout.leftBerth.maxZ) / 2;
		expect(
			new Vector3(
				compartmentSeat.x,
				compartmentSeat.y,
				leftBerthCentreZ,
			).project(camera).x,
		).toBeLessThan(-0.2);
	});

	it("leaves a clear sightline through the aperture at the original window plane", () => {
		const { window } = layout;
		expect(window.x).toBe(-innerWall);
		const room = createCompartment();
		room.updateMatrixWorld(true);
		const origin = point(compartmentView.eye);
		function traceWindow(y: number, z: number) {
			const target = new Vector3(window.x, y, z);
			const ray = new Raycaster(
				origin,
				target.clone().sub(origin).normalize(),
				0,
				origin.distanceTo(target) + 0.25,
			);
			return ray.intersectObject(room, true);
		}
		const paneY = (window.bottom + window.top) / 2;
		expect(traceWindow(paneY, window.centreZ)).toHaveLength(0);
		expect(traceWindow(paneY, window.maxZ + 0.1).length).toBeGreaterThan(0);
	});
});
