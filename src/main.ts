import type { Scene } from "three";
import { RouteClock } from "./core/clock";
import { startLoop } from "./core/loop";
import { createGirl } from "./npc/girl";
import { createCabinCamera } from "./render/cabinCamera";
import {
	DEFAULT_QUALITY_TIER,
	getQualityPreset,
	type QualityTier,
} from "./render/quality";
import {
	contextAttributes,
	createRenderer,
	type RendererFrameMetrics,
} from "./render/renderer";
import { createSkyDome } from "./render/sky";
import { createTestScene } from "./render/test-scene";
import { createTimeOfDayState, evaluateTimeOfDay } from "./render/timeOfDay";
import { createSnowVolume } from "./render/weather";
import { createCompartment } from "./train/compartment";
import { compartmentSeat, compartmentView } from "./train/compartmentLayout";
import { createPauseOverlay } from "./ui/pause";
import { createBirchWorld, DEFAULT_ROUTE_SEED } from "./world";
import "./style.css";

declare global {
	interface Window {
		__NTE__: { ready: Promise<void> };
	}
}

// Mirrors src/dev/params.ts and src/dev/overlay.ts. Spelled out here because static
// imports of dev/ are forbidden outside an import.meta.env.DEV guard (ARCHITECTURE §4.1).
type DevParams = {
	readonly rideT?: number;
	readonly seed?: number;
	readonly speedKmh?: number;
	readonly quality?: QualityTier;
	readonly noPost?: boolean;
	readonly hideOverlay: boolean;
};
type DevOverlayContext = {
	readonly clock: RouteClock;
	readonly scene: Scene;
	readonly getMetrics: () => RendererFrameMetrics;
	readonly getVisibleChunks: () => number;
	readonly getChunkPoolSize: () => number;
	readonly getSnowQuads: () => number;
};
type DevOverlay = {
	begin(): void;
	end(): void;
	update(): void;
};

const FIXED_STEP_SEC = 1 / 60;
const VIEW_DISTANCE_M = 800;

const app = document.querySelector("main");
if (!app) throw new Error("Missing app container.");

const canvas = document.createElement("canvas");
const context = canvas.getContext("webgl2", contextAttributes);
if (context) {
	canvas.setAttribute("role", "img");
	canvas.setAttribute(
		"aria-label",
		"View from inside a night train compartment",
	);
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
					overlayContext: DevOverlayContext,
					params: DevParams,
			  ) => DevOverlay)
			| undefined;
		if (import.meta.env.DEV) {
			const dev = await import("./dev/index");
			devParams = dev.readDevParams();
			attachDevTools = dev.attachDevTools;
		}

		const quality = devParams?.quality ?? DEFAULT_QUALITY_TIER;
		const preset = getQualityPreset(quality);
		draw.configure({
			quality,
			postEnabled: !devParams?.noPost,
		});

		const routeSeed = devParams?.seed ?? DEFAULT_ROUTE_SEED;
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
			routeSeed,
			maxSceneryDistanceM: preset.maxSceneryDistanceM,
		});
		const sky = createSkyDome(routeSeed);
		const snow = createSnowVolume({ quality, seed: routeSeed });
		const todState = createTimeOfDayState();

		scene.add(
			createCompartment(),
			createGirl(compartmentSeat),
			sky.mesh,
			snow.mesh,
		);
		const cabin = createCabinCamera(
			compartmentView.eye,
			compartmentView.focus,
			VIEW_DISTANCE_M,
		);

		let boarded = false;
		let paused = true;
		const showPaused = createPauseOverlay(app, () => {
			boarded = true;
			setPaused(false);
		});
		showPaused(true, "Board the train");

		function setPaused(value: boolean) {
			paused = value;
			cabin.release();
			showPaused(paused, "Paused — click to continue");
		}

		window.addEventListener("keydown", (event) => {
			if (event.key === "Escape" && boarded && !event.repeat) {
				setPaused(!paused);
			}
		});
		const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
		canvas.addEventListener("pointermove", (event) => {
			if (paused || reducedMotion.matches || event.pointerType !== "mouse")
				return;
			const bounds = canvas.getBoundingClientRect();
			cabin.aim(
				(2 * (event.clientX - bounds.left)) / bounds.width - 1,
				(2 * (event.clientY - bounds.top)) / bounds.height - 1,
			);
		});
		canvas.addEventListener("pointerleave", cabin.release);
		window.addEventListener("blur", cabin.release);
		document.addEventListener("visibilitychange", cabin.release);
		reducedMotion.addEventListener("change", cabin.release);

		const devOverlay =
			attachDevTools && devParams
				? attachDevTools(
						draw.renderer,
						{
							clock,
							scene,
							getMetrics: () => draw.getMetrics(),
							getVisibleChunks: () => world.chunks.getVisibleChunkCount(),
							getChunkPoolSize: () => world.chunks.getChunkPoolSize(),
							getSnowQuads: () => snow.quadCount,
						},
						devParams,
					)
				: undefined;

		startLoop(
			(dt) => {
				if (paused) return;
				clock.advance(dt);
				cabin.update(dt);
			},
			(alpha) => {
				const rideT = clock.rideT + (paused ? 0 : alpha * FIXED_STEP_SEC);
				const distanceM = clock.distanceAt(rideT);
				const continuousHour =
					clock.startHour +
					Math.min(rideT, clock.durationSec) * clock.compressionHoursPerSec;
				const tod = evaluateTimeOfDay(continuousHour, todState);

				cabin.render(paused ? 1 : alpha);
				world.update(distanceM, tod, cabin.camera);
				sky.update(tod, cabin.camera.position, rideT);
				snow.update({
					cameraPosition: cabin.camera.position,
					rideT,
					distanceM,
					trainSpeedMps: clock.speedKmhAt(rideT) / 3.6,
					snowColor: tod.snowColor,
					snowIntensity: tod.snowIntensity,
					fogDensity: tod.fogDensity,
				});
				draw.setExposure(tod.exposure);

				devOverlay?.begin();
				draw(scene, cabin.camera);
				devOverlay?.end();
				devOverlay?.update();
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
