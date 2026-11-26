import type { Scene } from "three";
import { applyNightAtmosphere, type NightAtmosphere } from "./atmosphere";
import { TreadmillChunkManager } from "./scenery/chunkManager";

export const DEFAULT_ROUTE_SEED = 1986;

export interface BirchWorldOptions {
	readonly routeSeed?: number;
}

export interface BirchWorld {
	readonly atmosphere: NightAtmosphere;
	readonly chunks: TreadmillChunkManager;
	update(distanceM: number): void;
	dispose(): void;
}

export function createBirchWorld(
	scene: Scene,
	options: BirchWorldOptions = {},
): BirchWorld {
	const atmosphere = applyNightAtmosphere(scene);
	const chunks = new TreadmillChunkManager({
		routeSeed: options.routeSeed ?? DEFAULT_ROUTE_SEED,
		fogCutoffM: atmosphere.fogCutoffM,
	});
	scene.add(chunks.root);

	return {
		atmosphere,
		chunks,
		update(distanceM: number) {
			chunks.update(distanceM);
		},
		dispose() {
			chunks.dispose();
		},
	};
}
