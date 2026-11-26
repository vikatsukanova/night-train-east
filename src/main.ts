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
import "./style.css";

declare global {
	interface Window {
		__NTE__: { ready: Promise<void> };
	}
}

const app = document.querySelector("main");
if (!app) throw new Error("Missing app container.");

const canvas = document.createElement("canvas");
const context = canvas.getContext("webgl2", contextAttributes);
if (context) {
	canvas.setAttribute("role", "img");
	canvas.setAttribute("aria-label", "Third-person view inside the night train");
	app.append(canvas);

	const draw = createRenderer(canvas, context);
	const { scene } = createTestScene();
	const carriage = createCarriage(avatarRadius);
	const avatar = createAvatar();
	const player = createController(spawn);
	const rig = createCameraRig();
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
	let onFirstFrame: (() => void) | undefined;
	const ready = new Promise<void>((resolve) => {
		onFirstFrame = resolve;
	});
	window.__NTE__ = { ready };
	startLoop(
		(dt) => {
			if (!input.locked()) return;
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
			const pose = player.sample(blend);
			rig.render(blend, pose, carriage.render(blend));
			avatar.render(pose, rig.camera.position);
			draw(scene, rig.camera);
			onFirstFrame?.();
			onFirstFrame = undefined;
		},
	);
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
