import {
	NoToneMapping,
	type PerspectiveCamera,
	type Scene,
	type Texture,
	WebGLRenderer,
} from "three";
import { createPostPipeline, type PostPipeline } from "./post";
import {
	DEFAULT_QUALITY_TIER,
	getQualityPreset,
	type QualityTier,
} from "./quality";

// Antialiasing is performed in the merged post-processing pass (FXAA), avoiding
// an extra MSAA backbuffer allocation on integrated GPUs (RENDERING §6.1).
export const contextAttributes: WebGLContextAttributes = {
	alpha: false,
	antialias: false,
	powerPreference: "high-performance",
};

export interface RendererConfig {
	readonly quality?: QualityTier;
	readonly postEnabled?: boolean;
}

export interface RendererFrameMetrics {
	readonly sceneCalls: number;
	readonly sceneTriangles: number;
	readonly postCalls: number;
	readonly postTriangles: number;
	readonly renderWidth: number;
	readonly renderHeight: number;
	readonly quality: QualityTier;
	readonly postEnabled: boolean;
	readonly halfFloat: boolean;
	readonly bloomActive: boolean;
	readonly hasLut: boolean;
	readonly postPassCount: number;
}

export function createRenderer(
	canvas: HTMLCanvasElement,
	context: WebGL2RenderingContext,
	initialConfig: RendererConfig = {},
) {
	const renderer = new WebGLRenderer({ canvas, context, ...contextAttributes });
	renderer.toneMapping = NoToneMapping;
	renderer.info.autoReset = false;

	let quality: QualityTier = initialConfig.quality ?? DEFAULT_QUALITY_TIER;
	let postEnabled = initialConfig.postEnabled ?? true;
	let postPipeline: PostPipeline | null = null;
	let pendingLut: { texture: Texture | null; opacity: number } | null = null;

	let lastWidth = 0;
	let lastHeight = 0;
	let lastDpr = 0;
	let renderWidth = 0;
	let renderHeight = 0;
	let directSceneCalls = 0;
	let directSceneTriangles = 0;

	function resetPostPipeline() {
		postPipeline?.dispose();
		postPipeline = null;
	}

	function configure(config: RendererConfig) {
		const nextQuality = config.quality ?? quality;
		const nextPost = config.postEnabled ?? postEnabled;
		const changed = nextQuality !== quality || nextPost !== postEnabled;
		quality = nextQuality;
		postEnabled = nextPost;
		if (changed) {
			resetPostPipeline();
			lastWidth = 0;
			lastHeight = 0;
			lastDpr = 0;
		}
	}

	const draw = (scene: Scene, camera: PerspectiveCamera) => {
		const preset = getQualityPreset(quality);
		const width = Math.max(canvas.clientWidth, 1);
		const height = Math.max(canvas.clientHeight, 1);
		const dpr = Math.min(
			window.devicePixelRatio || 1,
			preset.maxDpr,
			preset.maxWidth / width,
			preset.maxHeight / height,
		);
		const resized =
			width !== lastWidth || height !== lastHeight || dpr !== lastDpr;
		if (resized) {
			renderer.setDrawingBufferSize(width, height, dpr);
			renderWidth = Math.max(1, Math.floor(width * dpr));
			renderHeight = Math.max(1, Math.floor(height * dpr));
			camera.aspect = width / height;
			camera.updateProjectionMatrix();
			lastWidth = width;
			lastHeight = height;
			lastDpr = dpr;
		}

		if (postEnabled) {
			if (!postPipeline) {
				postPipeline = createPostPipeline(renderer, scene, camera, {
					bloom: preset.bloom,
				});
				if (pendingLut) {
					postPipeline.setLut(pendingLut.texture, pendingLut.opacity);
				}
				postPipeline.setSize(width, height);
			} else {
				postPipeline.setSceneAndCamera(scene, camera);
				if (resized) {
					postPipeline.setSize(width, height);
				}
			}
			postPipeline.render();
		} else {
			renderer.info.reset();
			renderer.render(scene, camera);
			directSceneCalls = renderer.info.render.calls;
			directSceneTriangles = renderer.info.render.triangles;
		}
	};

	function setExposure(exposure: number) {
		renderer.toneMappingExposure = exposure;
	}

	function setLut(texture: Texture | null, opacity = 1) {
		pendingLut = { texture, opacity };
		postPipeline?.setLut(texture, opacity);
	}

	function getMetrics(): RendererFrameMetrics {
		if (postEnabled && postPipeline) {
			const post = postPipeline.getMetrics();
			return {
				sceneCalls: post.sceneCalls,
				sceneTriangles: post.sceneTriangles,
				postCalls: post.postCalls,
				postTriangles: post.postTriangles,
				renderWidth,
				renderHeight,
				quality,
				postEnabled: true,
				halfFloat: post.halfFloat,
				bloomActive: post.bloomActive,
				hasLut: post.hasLut,
				postPassCount: post.postPassCount,
			};
		}
		return {
			sceneCalls: directSceneCalls,
			sceneTriangles: directSceneTriangles,
			postCalls: 0,
			postTriangles: 0,
			renderWidth,
			renderHeight,
			quality,
			postEnabled: false,
			halfFloat: false,
			bloomActive: false,
			hasLut: false,
			postPassCount: 0,
		};
	}

	function dispose() {
		resetPostPipeline();
		renderer.dispose();
	}

	return Object.assign(draw, {
		renderer,
		configure,
		setExposure,
		setLut,
		getMetrics,
		dispose,
	});
}
