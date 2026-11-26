import {
	BloomEffect,
	type Effect,
	EffectComposer,
	EffectPass,
	FXAAEffect,
	LUT3DEffect,
	RenderPass,
	ToneMappingEffect,
	ToneMappingMode,
	VignetteEffect,
} from "postprocessing";
import {
	type Camera,
	HalfFloatType,
	NoToneMapping,
	type Scene,
	type Texture,
	UnsignedByteType,
	type WebGLRenderer,
	type WebGLRenderTarget,
} from "three";

export interface PostPipelineOptions {
	readonly bloom: boolean;
}

export interface PostFrameMetrics {
	readonly sceneCalls: number;
	readonly sceneTriangles: number;
	readonly postCalls: number;
	readonly postTriangles: number;
	readonly halfFloat: boolean;
	readonly bloomActive: boolean;
	readonly hasLut: boolean;
	readonly postPassCount: number;
}

export interface PostPipeline {
	render(): void;
	setSize(width: number, height: number): void;
	setSceneAndCamera(scene: Scene, camera: Camera): void;
	/** Slot/hook for P4 3D LUT colour grading; pass null to clear. */
	setLut(lut: Texture | null, opacity?: number): void;
	getMetrics(): PostFrameMetrics;
	dispose(): void;
}

class SceneRenderPass extends RenderPass {
	private readonly onAfterSceneRender: (
		calls: number,
		triangles: number,
	) => void;

	constructor(
		scene: Scene,
		camera: Camera,
		onAfterSceneRender: (calls: number, triangles: number) => void,
	) {
		super(scene, camera);
		this.onAfterSceneRender = onAfterSceneRender;
	}

	override render(
		renderer: WebGLRenderer,
		inputBuffer: WebGLRenderTarget | null,
		outputBuffer: WebGLRenderTarget | null,
		deltaTime?: number,
		stencilTest?: boolean,
	): void {
		renderer.info.reset();
		super.render(renderer, inputBuffer, outputBuffer, deltaTime, stencilTest);
		this.onAfterSceneRender(
			renderer.info.render.calls,
			renderer.info.render.triangles,
		);
		// Reset so subsequent post-processing passes are counted separately from scene draws.
		renderer.info.reset();
	}
}

export function createPostPipeline(
	renderer: WebGLRenderer,
	scene: Scene,
	camera: Camera,
	options: PostPipelineOptions,
): PostPipeline {
	renderer.toneMapping = NoToneMapping;
	renderer.info.autoReset = false;

	const gl = renderer.getContext();
	const supportsHalfFloat =
		gl.getExtension("EXT_color_buffer_half_float") !== null;
	const frameBufferType = supportsHalfFloat ? HalfFloatType : UnsignedByteType;
	const bloomActive = Boolean(options.bloom && supportsHalfFloat);

	const composer = new EffectComposer(renderer, {
		frameBufferType,
		multisampling: 0,
	});

	let sceneCalls = 0;
	let sceneTriangles = 0;
	let postCalls = 0;
	let postTriangles = 0;

	const scenePass = new SceneRenderPass(scene, camera, (calls, triangles) => {
		sceneCalls = calls;
		sceneTriangles = triangles;
	});
	composer.addPass(scenePass);

	// FXAA samples inputBuffer directly with BlendFunction.SRC, so it runs first inside
	// the merged uber-pass, followed by optional bloom, AgX tone mapping, optional LUT, and vignette.
	const fxaaEffect = new FXAAEffect();
	const bloomEffect = bloomActive
		? new BloomEffect({
				mipmapBlur: true,
				luminanceThreshold: 1.12,
				luminanceSmoothing: 0.25,
				intensity: 0.42,
				radius: 0.65,
			})
		: null;
	const toneMappingEffect = new ToneMappingEffect({
		mode: ToneMappingMode.AGX,
	});
	const vignetteEffect = new VignetteEffect({
		offset: 0.35,
		darkness: 0.38,
	});

	let activeCamera: Camera = camera;
	let lutEffect: LUT3DEffect | null = null;
	let effectPass: EffectPass | null = null;

	function rebuildEffectPass(): void {
		if (effectPass) {
			composer.removePass(effectPass);
			effectPass.dispose();
		}
		const effects: Effect[] = [fxaaEffect];
		if (bloomEffect) effects.push(bloomEffect);
		effects.push(toneMappingEffect);
		if (lutEffect) effects.push(lutEffect);
		effects.push(vignetteEffect);

		effectPass = new EffectPass(activeCamera, ...effects);
		composer.addPass(effectPass);
	}

	rebuildEffectPass();

	return {
		render() {
			composer.render();
			postCalls = renderer.info.render.calls;
			postTriangles = renderer.info.render.triangles;
		},
		setSize(width: number, height: number) {
			composer.setSize(width, height, false);
		},
		setSceneAndCamera(nextScene: Scene, nextCamera: Camera) {
			if (
				scenePass.mainScene === nextScene &&
				scenePass.mainCamera === nextCamera
			) {
				return;
			}
			activeCamera = nextCamera;
			composer.setMainScene(nextScene);
			composer.setMainCamera(nextCamera);
		},
		setLut(lut: Texture | null, opacity = 1) {
			if (lutEffect) {
				lutEffect.dispose();
				lutEffect = null;
			}
			if (lut) {
				lutEffect = new LUT3DEffect(lut, { tetrahedralInterpolation: true });
				lutEffect.blendMode.opacity.value = opacity;
			}
			rebuildEffectPass();
		},
		getMetrics(): PostFrameMetrics {
			return {
				sceneCalls,
				sceneTriangles,
				postCalls,
				postTriangles,
				halfFloat: supportsHalfFloat,
				bloomActive,
				hasLut: lutEffect !== null,
				postPassCount: Math.max(0, composer.passes.length - 1),
			};
		},
		dispose() {
			composer.dispose();
			if (lutEffect) {
				lutEffect.dispose();
				lutEffect = null;
			}
			fxaaEffect.dispose();
			bloomEffect?.dispose();
			toneMappingEffect.dispose();
			vignetteEffect.dispose();
		},
	};
}
