import type { WebGLRenderer } from "three";
import {
	createDevOverlay,
	type DevOverlay,
	type DevOverlayContext,
	type DevStatsSnapshot,
} from "./overlay";
import { type DevParams, parseDevParams } from "./params";

export type { DevOverlay, DevOverlayContext, DevParams, DevStatsSnapshot };

export function readDevParams(): DevParams {
	return parseDevParams(window.location.search);
}

export function attachDevTools(
	renderer: WebGLRenderer,
	context: DevOverlayContext,
	params: DevParams,
): DevOverlay {
	const overlay = createDevOverlay(renderer, context, params.hideOverlay);
	const handle = window.__NTE__ as typeof window.__NTE__ & {
		stats?: () => DevStatsSnapshot;
		resetFrameStats?: () => void;
		setRideT?: (seconds: number) => void;
	};
	handle.stats = () => overlay.snapshot();
	handle.resetFrameStats = () => overlay.resetFrameStats();
	handle.setRideT = (seconds: number) => context.clock.setRideT(seconds);
	return overlay;
}
