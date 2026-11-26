import { startLoop } from "./core/loop";
import { contextAttributes, createRenderer } from "./render/renderer";
import { createTestScene } from "./render/test-scene";
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
	canvas.setAttribute(
		"aria-label",
		"View through a night train carriage window",
	);
	app.append(canvas);

	const draw = createRenderer(canvas, context);
	const { scene, camera } = createTestScene();
	let onFirstFrame: (() => void) | undefined;
	const ready = new Promise<void>((resolve) => {
		onFirstFrame = resolve;
	});
	window.__NTE__ = { ready };
	startLoop(
		() => {},
		() => {
			draw(scene, camera);
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
