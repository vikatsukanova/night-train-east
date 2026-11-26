import type { WebGLRenderer } from "three";
import type { RouteClock } from "../core/clock";
import {
	createDevOverlay,
	type DevOverlay,
	type DevStatsSnapshot,
} from "./overlay";
import { type DevParams, parseDevParams } from "./params";

export type { DevOverlay, DevParams, DevStatsSnapshot };

export function readDevParams(): DevParams {
	return parseDevParams(window.location.search);
}

export function attachDevTools(
	renderer: WebGLRenderer,
	clock: RouteClock,
	getVisibleChunks: () => number,
	params: DevParams,
): DevOverlay {
	const overlay = createDevOverlay(renderer, params.hideOverlay);
	const handle = window.__NTE__ as typeof window.__NTE__ & {
		stats?: () => DevStatsSnapshot;
		setRideT?: (seconds: number) => void;
	};
	handle.stats = () => overlay.snapshot(clock, getVisibleChunks());
	handle.setRideT = (seconds: number) => clock.setRideT(seconds);
	return overlay;
}
