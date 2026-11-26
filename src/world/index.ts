import type { Scene } from "three";
import type { TimeOfDayState } from "../render/timeOfDay";
import { applyNightAtmosphere, type NightAtmosphere } from "./atmosphere";
import { TreadmillChunkManager } from "./scenery/chunkManager";

export const DEFAULT_ROUTE_SEED = 1986;

export interface BirchWorldOptions {
	readonly routeSeed?: number;
	readonly maxSceneryDistanceM?: number;
}

export interface BirchWorld {
	readonly atmosphere: NightAtmosphere;
	readonly chunks: TreadmillChunkManager;
	update(distanceM: number, tod?: TimeOfDayState): void;
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

	return {
		atmosphere,
		chunks,
		update(distanceM: number, tod?: TimeOfDayState) {
			const fogCutoffM = tod
				? atmosphere.applyTimeOfDay(tod)
				: atmosphere.fogCutoffM;
			chunks.update(distanceM, Math.min(fogCutoffM, maxDistanceM));
		},
		dispose() {
			chunks.dispose();
		},
	};
}
