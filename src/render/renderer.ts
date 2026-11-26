import { type PerspectiveCamera, type Scene, WebGLRenderer } from "three";

export const contextAttributes: WebGLContextAttributes = {
	alpha: false,
	antialias: true,
};
const MAX_DPR = 1.75;
const MAX_WIDTH = 1600;
const MAX_HEIGHT = 900;

export function createRenderer(
	canvas: HTMLCanvasElement,
	context: WebGL2RenderingContext,
) {
	const renderer = new WebGLRenderer({ canvas, context, ...contextAttributes });
	let lastWidth = 0;
	let lastHeight = 0;
	let lastDpr = 0;

	return (scene: Scene, camera: PerspectiveCamera) => {
		const width = Math.max(canvas.clientWidth, 1);
		const height = Math.max(canvas.clientHeight, 1);
		const dpr = Math.min(
			window.devicePixelRatio,
			MAX_DPR,
			MAX_WIDTH / width,
			MAX_HEIGHT / height,
		);
		if (width !== lastWidth || height !== lastHeight || dpr !== lastDpr) {
			renderer.setDrawingBufferSize(width, height, dpr);
			camera.aspect = width / height;
			camera.updateProjectionMatrix();
			lastWidth = width;
			lastHeight = height;
			lastDpr = dpr;
		}

		renderer.render(scene, camera);
	};
}
