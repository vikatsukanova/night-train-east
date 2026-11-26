import Stats from "stats-gl";
import type {
	BufferGeometry,
	Material,
	Mesh,
	Scene,
	Texture,
	WebGLRenderer,
} from "three";
import { InstancedMesh } from "three";
import { formatTimeOfDay, type RouteClock } from "../core/clock";
import type { QualityTier } from "../render/quality";
import type { RendererFrameMetrics } from "../render/renderer";

const FRAME_WINDOW_SIZE = 120;
const STALL_GAP_MS = 250;
const BYTES_PER_MIB = 1024 * 1024;

export interface FrameTimeSummary {
	readonly p50: number;
	readonly p95: number;
	readonly max: number;
	readonly count: number;
}

export interface DevStatsSnapshot {
	/** Scene draw calls (post-processing passes excluded). */
	readonly calls: number;
	readonly sceneCalls: number;
	readonly postCalls: number;
	/** Scene triangles (post-processing passes excluded). */
	readonly triangles: number;
	readonly sceneTriangles: number;
	readonly postTriangles: number;
	readonly postPassCount: number;
	readonly geometries: number;
	readonly textures: number;
	/** Estimated VRAM usage (geometry + textures + framebuffers), in MiB. */
	readonly estimatedGpuMemoryMb: number;
	readonly frameMs: number;
	readonly frameMedianMs: number;
	readonly frameP95Ms: number;
	readonly frameMaxMs: number;
	readonly cpuRenderMs: number;
	readonly sampleCount: number;
	readonly timeToFirstFrameMs: number;
	readonly renderWidth: number;
	readonly renderHeight: number;
	readonly quality: QualityTier;
	readonly postEnabled: boolean;
	readonly halfFloat: boolean;
	readonly bloomActive: boolean;
	readonly snowQuads: number;
	readonly rideT: number;
	readonly distanceM: number;
	readonly speedKmh: number;
	readonly timeOfDay: string;
	readonly visibleChunks: number;
	readonly chunkPoolSize: number;
}

export interface DevOverlayContext {
	readonly clock: RouteClock;
	readonly scene: Scene;
	readonly getMetrics: () => RendererFrameMetrics;
	readonly getVisibleChunks: () => number;
	readonly getChunkPoolSize: () => number;
	readonly getSnowQuads: () => number;
}

export interface DevOverlay {
	begin(): void;
	end(): void;
	update(): void;
	snapshot(): DevStatsSnapshot;
	resetFrameStats(): void;
	dispose(): void;
}

export function computeFramePercentiles(
	samples: readonly number[] | Float64Array,
	count: number,
): FrameTimeSummary {
	if (count <= 0) {
		return { p50: 0, p95: 0, max: 0, count: 0 };
	}
	const sorted = new Float64Array(count);
	for (let i = 0; i < count; i++) {
		sorted[i] = samples[i] ?? 0;
	}
	sorted.sort();
	const p50Index = Math.floor((count - 1) * 0.5);
	const p95Index = Math.min(count - 1, Math.ceil(count * 0.95) - 1);
	return {
		p50: sorted[p50Index] ?? 0,
		p95: sorted[p95Index] ?? 0,
		max: sorted[count - 1] ?? 0,
		count,
	};
}

function estimateTextureBytes(texture: Texture): number {
	const image = texture.image as
		| { width?: number; height?: number; data?: ArrayBufferView }
		| undefined;
	if (!image) return 0;
	const width = image.width ?? 0;
	const height = image.height ?? 0;
	const base =
		image.data && image.data.byteLength > 0
			? image.data.byteLength
			: width * height * 4;
	return texture.generateMipmaps ? Math.ceil(base * (4 / 3)) : base;
}

function estimateGeometryBytes(geometry: BufferGeometry): number {
	let bytes = 0;
	for (const attr of Object.values(geometry.attributes)) {
		bytes += attr.array.byteLength;
	}
	if (geometry.index) {
		bytes += geometry.index.array.byteLength;
	}
	return bytes;
}

function estimateSceneGpuMemoryMb(
	scene: Scene,
	metrics: RendererFrameMetrics,
): number {
	const seenGeometries = new Set<BufferGeometry>();
	const seenTextures = new Set<Texture>();
	let totalBytes = 0;

	scene.traverse((obj) => {
		const mesh = obj as Mesh;
		if (mesh.geometry && !seenGeometries.has(mesh.geometry)) {
			seenGeometries.add(mesh.geometry);
			totalBytes += estimateGeometryBytes(mesh.geometry);
		}
		if (obj instanceof InstancedMesh) {
			totalBytes += obj.instanceMatrix.array.byteLength;
			if (obj.instanceColor) {
				totalBytes += obj.instanceColor.array.byteLength;
			}
		}
		const materials: Material[] = Array.isArray(mesh.material)
			? mesh.material
			: mesh.material
				? [mesh.material]
				: [];
		for (const mat of materials) {
			for (const value of Object.values(mat)) {
				if (
					value &&
					typeof value === "object" &&
					"isTexture" in value &&
					value.isTexture === true
				) {
					const tex = value as Texture;
					if (!seenTextures.has(tex)) {
						seenTextures.add(tex);
						totalBytes += estimateTextureBytes(tex);
					}
				}
			}
		}
	});

	// Estimate backbuffer + post-processing render target allocations.
	const pixels = Math.max(1, metrics.renderWidth * metrics.renderHeight);
	// Default drawing buffer: RGBA8 color (4 B) + D24S8 depth (4 B).
	totalBytes += pixels * 8;
	if (metrics.postEnabled) {
		const colorBytesPerPx = metrics.halfFloat ? 8 : 4;
		// EffectComposer ping-pong targets (input + output) + depth buffer.
		totalBytes += pixels * (colorBytesPerPx * 2 + 4);
		if (metrics.bloomActive) {
			// Mipmap bloom pyramid (~1.33x full-res HDR target).
			totalBytes += Math.ceil(pixels * colorBytesPerPx * 1.33);
		}
	}

	return Number((totalBytes / BYTES_PER_MIB).toFixed(2));
}

export function createDevOverlay(
	renderer: WebGLRenderer,
	context: DevOverlayContext,
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
		padding: "5px 8px",
		borderRadius: "4px",
		background: "rgba(9, 16, 28, 0.82)",
		color: "#cde0f8",
		fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
		fontSize: "11px",
		lineHeight: "1.45",
		pointerEvents: "none",
		whiteSpace: "pre",
		border: "1px solid rgba(154, 186, 224, 0.24)",
	});

	if (!hidden) {
		document.body.append(stats.dom, readout);
	}

	const frameBuffer = new Float64Array(FRAME_WINDOW_SIZE);
	let frameWriteIndex = 0;
	let frameCount = 0;
	let prevFrameStartMs = 0;
	let currentFrameBeginMs = 0;
	let lastFrameMs = 0;
	let lastCpuRenderMs = 0;
	let timeToFirstFrameMs = 0;
	let lastUpdateMs = 0;

	function resetFrameStats(): void {
		frameWriteIndex = 0;
		frameCount = 0;
		prevFrameStartMs = 0;
		lastFrameMs = 0;
	}

	function snapshot(): DevStatsSnapshot {
		const metrics = context.getMetrics();
		const frameSummary = computeFramePercentiles(frameBuffer, frameCount);
		const estimatedGpuMemoryMb = estimateSceneGpuMemoryMb(
			context.scene,
			metrics,
		);
		return {
			calls: metrics.sceneCalls,
			sceneCalls: metrics.sceneCalls,
			postCalls: metrics.postCalls,
			triangles: metrics.sceneTriangles,
			sceneTriangles: metrics.sceneTriangles,
			postTriangles: metrics.postTriangles,
			postPassCount: metrics.postPassCount,
			geometries: renderer.info.memory.geometries,
			textures: renderer.info.memory.textures,
			estimatedGpuMemoryMb,
			frameMs: Number(lastFrameMs.toFixed(2)),
			frameMedianMs: Number(frameSummary.p50.toFixed(2)),
			frameP95Ms: Number(frameSummary.p95.toFixed(2)),
			frameMaxMs: Number(frameSummary.max.toFixed(2)),
			cpuRenderMs: Number(lastCpuRenderMs.toFixed(2)),
			sampleCount: frameSummary.count,
			timeToFirstFrameMs: Number(timeToFirstFrameMs.toFixed(1)),
			renderWidth: metrics.renderWidth,
			renderHeight: metrics.renderHeight,
			quality: metrics.quality,
			postEnabled: metrics.postEnabled,
			halfFloat: metrics.halfFloat,
			bloomActive: metrics.bloomActive,
			snowQuads: context.getSnowQuads(),
			rideT: context.clock.rideT,
			distanceM: context.clock.distanceM,
			speedKmh: context.clock.speedKmh,
			timeOfDay: formatTimeOfDay(context.clock.timeOfDayHours),
			visibleChunks: context.getVisibleChunks(),
			chunkPoolSize: context.getChunkPoolSize(),
		};
	}

	return {
		begin() {
			const now = performance.now();
			if (prevFrameStartMs > 0) {
				const delta = now - prevFrameStartMs;
				if (delta > 0 && delta < STALL_GAP_MS) {
					lastFrameMs = delta;
					frameBuffer[frameWriteIndex] = delta;
					frameWriteIndex = (frameWriteIndex + 1) % FRAME_WINDOW_SIZE;
					if (frameCount < FRAME_WINDOW_SIZE) frameCount++;
				}
			}
			prevFrameStartMs = now;
			currentFrameBeginMs = now;
			if (!hidden) stats.begin();
		},
		end() {
			const now = performance.now();
			lastCpuRenderMs = now - currentFrameBeginMs;
			if (timeToFirstFrameMs === 0) {
				timeToFirstFrameMs = now;
			}
			if (!hidden) stats.end();
		},
		update() {
			if (hidden) return;
			stats.update();
			const now = performance.now();
			if (now - lastUpdateMs < 200) return;
			lastUpdateMs = now;
			const snap = snapshot();
			const trisK = (snap.sceneTriangles / 1000).toFixed(1);
			const postLabel = snap.postEnabled
				? `post ${snap.postCalls} (${snap.bloomActive ? "Bloom+" : ""}AgX+Vig+FXAA${snap.halfFloat ? " fp16" : " u8"})`
				: "post off";
			readout.textContent =
				`scene ${snap.sceneCalls} calls · ${trisK}k tris | ${postLabel}\n` +
				`frame ${snap.frameMedianMs.toFixed(1)}ms p50 · ${snap.frameP95Ms.toFixed(1)}ms p95 · ${snap.frameMaxMs.toFixed(1)}ms max · cpu ${snap.cpuRenderMs.toFixed(1)}ms\n` +
				`est vram ~${snap.estimatedGpuMemoryMb.toFixed(1)} MiB · geo ${snap.geometries} · tex ${snap.textures} · ${snap.renderWidth}×${snap.renderHeight} ${snap.quality} · snow ${snap.snowQuads}\n` +
				`t ${snap.rideT.toFixed(1)}s · ${snap.timeOfDay} · ${(snap.distanceM / 1000).toFixed(2)} km · chunks ${snap.visibleChunks}/${snap.chunkPoolSize}`;
		},
		snapshot,
		resetFrameStats,
		dispose() {
			stats.dom.remove();
			readout.remove();
			stats.dispose();
		},
	};
}
