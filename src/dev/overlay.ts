import Stats from "stats-gl";
import type { WebGLRenderer } from "three";
import { formatTimeOfDay, type RouteClock } from "../core/clock";

export interface DevStatsSnapshot {
	readonly calls: number;
	readonly triangles: number;
	readonly geometries: number;
	readonly textures: number;
	readonly rideT: number;
	readonly distanceM: number;
	readonly speedKmh: number;
	readonly timeOfDay: string;
	readonly visibleChunks: number;
}

export interface DevOverlay {
	begin(): void;
	end(): void;
	update(clock: RouteClock, visibleChunks: number): void;
	snapshot(clock: RouteClock, visibleChunks: number): DevStatsSnapshot;
	dispose(): void;
}

export function createDevOverlay(
	renderer: WebGLRenderer,
	hidden: boolean,
): DevOverlay {
	const stats = new Stats({
		trackGPU: true,
		trackFPS: true,
		horizontal: true,
	});

	void stats.init(renderer);

	const readout = document.createElement("aside");
	readout.setAttribute("aria-label", "Renderer diagnostics");
	Object.assign(readout.style, {
		position: "fixed",
		top: "52px",
		left: "6px",
		zIndex: "10000",
		padding: "4px 8px",
		borderRadius: "4px",
		background: "rgba(9, 16, 28, 0.78)",
		color: "#cde0f8",
		fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
		fontSize: "11px",
		lineHeight: "1.45",
		pointerEvents: "none",
		whiteSpace: "pre",
		border: "1px solid rgba(154, 186, 224, 0.22)",
	});

	if (!hidden) {
		document.body.append(stats.dom, readout);
	}

	let lastCalls = 0;
	let lastTriangles = 0;
	let lastUpdateMs = 0;

	function snapshot(
		clock: RouteClock,
		visibleChunks: number,
	): DevStatsSnapshot {
		return {
			calls: lastCalls,
			triangles: lastTriangles,
			geometries: renderer.info.memory.geometries,
			textures: renderer.info.memory.textures,
			rideT: clock.rideT,
			distanceM: clock.distanceM,
			speedKmh: clock.speedKmh,
			timeOfDay: formatTimeOfDay(clock.timeOfDayHours),
			visibleChunks,
		};
	}

	return {
		begin() {
			if (!hidden) stats.begin();
		},
		end() {
			lastCalls = renderer.info.render.calls;
			lastTriangles = renderer.info.render.triangles;
			if (!hidden) stats.end();
		},
		update(clock: RouteClock, visibleChunks: number) {
			if (hidden) return;
			stats.update();
			const now = performance.now();
			if (now - lastUpdateMs < 200) return;
			lastUpdateMs = now;
			const snap = snapshot(clock, visibleChunks);
			const trisK = (snap.triangles / 1000).toFixed(1);
			readout.textContent =
				`calls ${snap.calls} · tris ${trisK}k · geo ${snap.geometries} · tex ${snap.textures}\n` +
				`t ${snap.rideT.toFixed(1)}s · ${snap.timeOfDay} · ${(snap.distanceM / 1000).toFixed(2)} km · chunks ${snap.visibleChunks}`;
		},
		snapshot,
		dispose() {
			stats.dom.remove();
			readout.remove();
			stats.dispose();
		},
	};
}
