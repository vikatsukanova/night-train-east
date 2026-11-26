import { RouteClock } from "./core/clock";
import { startLoop } from "./core/loop";
import { avatarRadius, createAvatar } from "./player/avatar";
import { createCameraRig } from "./player/cameraRig";
import { createController } from "./player/controller";
import { createInput } from "./player/input";
import {
	createInteractionPrompt,
	nearestInteractable,
} from "./player/interact";
import { contextAttributes, createRenderer } from "./render/renderer";
import { createTestScene } from "./render/test-scene";
import { createCarriage } from "./train/carriage";
import { spawn } from "./train/layout";
import { createPauseOverlay } from "./ui/pause";
import { createBirchWorld } from "./world";
import "./style.css";

declare global {
	interface Window {
		__NTE__: { ready: Promise<void> };
	}
}

// Mirrors src/dev/params.ts. Spelled out here because static imports of dev/
// are forbidden outside an import.meta.env.DEV guard (ARCHITECTURE §4.1).
type DevParams = {
	readonly rideT?: number;
	readonly seed?: number;
	readonly speedKmh?: number;
	readonly hideOverlay: boolean;
};
type DevOverlay = {
	begin(): void;
	end(): void;
	update(clock: RouteClock, visibleChunks: number): void;
};

const FIXED_STEP_SEC = 1 / 60;
const VIEW_DISTANCE_M = 800;

const app = document.querySelector("main");
if (!app) throw new Error("Missing app container.");

const canvas = document.createElement("canvas");
const context = canvas.getContext("webgl2", contextAttributes);
if (context) {
	canvas.setAttribute("role", "img");
	canvas.setAttribute("aria-label", "Third-person view inside the night train");
	app.append(canvas);

	const draw = createRenderer(canvas, context);
	let onFirstFrame: (() => void) | undefined;
	const ready = new Promise<void>((resolve) => {
		onFirstFrame = resolve;
	});
	window.__NTE__ = { ready };

	async function boot(app: HTMLElement) {
		let devParams: DevParams | undefined;
		let attachDevTools:
			| ((
					renderer: typeof draw.renderer,
					clock: RouteClock,
					getVisibleChunks: () => number,
					params: DevParams,
			  ) => DevOverlay)
			| undefined;
		if (import.meta.env.DEV) {
			const dev = await import("./dev/index");
			devParams = dev.readDevParams();
			attachDevTools = dev.attachDevTools;
		}

		const { scene } = createTestScene();
		const clock = new RouteClock({
			...(devParams?.rideT !== undefined
				? { initialRideT: devParams.rideT }
				: {}),
			...(devParams?.speedKmh !== undefined
				? { segments: [{ atSec: 0, speedKmh: devParams.speedKmh }] }
				: {}),
		});
		const world = createBirchWorld(scene, {
			...(devParams?.seed !== undefined ? { routeSeed: devParams.seed } : {}),
		});
		const carriage = createCarriage(avatarRadius);
		const avatar = createAvatar();
		const player = createController(spawn);
		const rig = createCameraRig();
		rig.camera.far = VIEW_DISTANCE_M;
		scene.add(carriage.group, avatar.group);

		const showPrompt = createInteractionPrompt(app);
		const input = createInput(canvas, (locked) => {
			showPaused(!locked);
			if (!locked) showPrompt();
		});
		const showPaused = createPauseOverlay(app, input.capture);
		// Start paused so first-time players see the "click to continue" hint.
		showPaused(true);
		showPrompt();
		const interactables = [carriage.door];
		const devOverlay =
			attachDevTools && devParams
				? attachDevTools(
						draw.renderer,
						clock,
						() => world.chunks.getVisibleChunkCount(),
						devParams,
					)
				: undefined;

		startLoop(
			(dt) => {
				// Paused (no pointer lock): the ride and the player both hold still.
				if (!input.locked()) return;
				clock.advance(dt);
				const controls = input.read();
				rig.update(
					dt,
					controls.dx,
					controls.dy,
					player.state,
					carriage.colliders,
				);
				player.update(dt, controls, rig.yaw, carriage.door.walkable);
				const nearby = nearestInteractable(
					player.state,
					player.state.yaw,
					interactables,
				);
				if (controls.interact) nearby?.toggle(player.state);
				carriage.update(dt);
				showPrompt(nearby?.prompt(player.state));
			},
			(alpha) => {
				const blend = input.locked() ? alpha : 1;
				world.update(clock.distanceAt(clock.rideT + blend * FIXED_STEP_SEC));
				const pose = player.sample(blend);
				rig.render(blend, pose, carriage.render(blend));
				avatar.render(pose, rig.camera.position);
				devOverlay?.begin();
				draw(scene, rig.camera);
				devOverlay?.end();
				devOverlay?.update(clock, world.chunks.getVisibleChunkCount());
				onFirstFrame?.();
				onFirstFrame = undefined;
			},
		);
	}

	void boot(app);
} else {
	const message = document.createElement("section");
	const title = document.createElement("h1");
	const detail = document.createElement("p");
	title.textContent = "Night Train East";
	detail.textContent =
		"This browser couldn’t start WebGL 2. Try enabling hardware acceleration or opening the train in another desktop browser.";
	message.append(title, detail);
	app.append(message);
}
