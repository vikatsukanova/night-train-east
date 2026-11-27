import { type Camera, type Scene, Vector3 } from "three";
import type { TimeOfDayState } from "../render/timeOfDay";
import { applyNightAtmosphere, type NightAtmosphere } from "./atmosphere";
import { TreadmillChunkManager } from "./scenery/chunkManager";
import type { ViewRay } from "./scenery/chunkMath";

export const DEFAULT_ROUTE_SEED = 1986;

export interface BirchWorldOptions {
	readonly routeSeed?: number;
	readonly maxSceneryDistanceM?: number;
}

export interface BirchWorld {
	readonly atmosphere: NightAtmosphere;
	readonly chunks: TreadmillChunkManager;
	update(distanceM: number, tod?: TimeOfDayState, camera?: Camera): void;
	dispose(): void;
}

export function createBirchWorld(
	scene: Scene,
	options: BirchWorldOptions = {},
): BirchWorld {
	const atmosphere = applyNightAtmosphere(scene);
	const maxDistanceM = options.maxSceneryDistanceM ?? Number.POSITIVE_INFINITY;
	const chunks = new TreadmillChunkManager({
		routeSeed: options.routeSeed ?? DEFAULT_ROUTE_SEED,
		fogCutoffM: Math.min(atmosphere.fogCutoffM, maxDistanceM),
	});
	scene.add(chunks.root);

	const camPos = new Vector3();
	const camDir = new Vector3();
	const view = { px: 0, py: 0, pz: 0, fx: 0, fy: 0, fz: -1 };
	const viewRay = (camera: Camera): ViewRay => {
		camera.updateMatrixWorld();
		camera.getWorldPosition(camPos);
		camera.getWorldDirection(camDir);
		view.px = camPos.x;
		view.py = camPos.y;
		view.pz = camPos.z;
		view.fx = camDir.x;
		view.fy = camDir.y;
		view.fz = camDir.z;
		return view;
	};

	return {
		atmosphere,
		chunks,
		update(distanceM: number, tod?: TimeOfDayState, camera?: Camera) {
			const fogCutoffM = tod
				? atmosphere.applyTimeOfDay(tod)
				: atmosphere.fogCutoffM;
			chunks.update(
				distanceM,
				fogCutoffM,
				maxDistanceM,
				camera ? viewRay(camera) : undefined,
			);
		},
		dispose() {
			chunks.dispose();
		},
	};
}
