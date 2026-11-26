import {
	Color,
	DirectionalLight,
	FogExp2,
	HemisphereLight,
	type Scene,
} from "three";
import type { TimeOfDayState } from "../render/timeOfDay";

export interface NightAtmosphere {
	readonly fog: FogExp2;
	readonly fogColor: Color;
	fogDensity: number;
	fogCutoffM: number;
	readonly moonLight: DirectionalLight;
	readonly skyFill: HemisphereLight;
	applyTimeOfDay(tod: TimeOfDayState): number;
}

/** Night M1 (22:45) fog values from docs/RENDERING.md §4.2. */
export const NIGHT_FOG_COLOR_HEX = 0x112036;
export const NIGHT_FOG_DENSITY = 0.0065;

/** ~98% fog opacity threshold (transmittance = 0.02 => ~304 m at density 0.0065; RENDERING §3). */
export const FOG_CUTOFF_TRANSMITTANCE = 0.02;

const CELESTIAL_LIGHT_DISTANCE_M = 50;
// Calibrates RENDERING §4.2 artistic light intensities for Three.js physical units under AgX.
const DIRECTIONAL_PHYSICAL_SCALE = 2.4;
const HEMI_PHYSICAL_SCALE = 1.5;

/**
 * Distance at which Three.js FogExp2 reaches (1 - transmittanceThreshold) opacity:
 *   exp(-(density * d)^2) = threshold  =>  d = sqrt(-ln(threshold)) / density
 */
export function fogVisibilityDistance(
	density: number,
	transmittanceThreshold = FOG_CUTOFF_TRANSMITTANCE,
): number {
	if (density <= 0) return Number.POSITIVE_INFINITY;
	return Math.sqrt(-Math.log(transmittanceThreshold)) / density;
}

/**
 * Applies exterior atmosphere (FogExp2 synced to sky horizon, sun/moon directional + sky hemisphere fill)
 * with dynamic Time-of-Day updates across dusk → night → dawn.
 */
export function applyNightAtmosphere(scene: Scene): NightAtmosphere {
	const fogColor = new Color(NIGHT_FOG_COLOR_HEX);
	const fog = new FogExp2(fogColor, NIGHT_FOG_DENSITY);
	scene.background = fog.color;
	scene.fog = fog;

	const moonLight = new DirectionalLight(
		0x6b8fc7,
		0.45 * DIRECTIONAL_PHYSICAL_SCALE,
	);
	moonLight.position.set(-34, 31, -21);

	const skyFill = new HemisphereLight(
		0x1c3257,
		0x152033,
		0.55 * HEMI_PHYSICAL_SCALE,
	);

	scene.add(skyFill, moonLight);

	const state: NightAtmosphere = {
		fog,
		fogColor: fog.color,
		fogDensity: NIGHT_FOG_DENSITY,
		fogCutoffM: fogVisibilityDistance(NIGHT_FOG_DENSITY),
		moonLight,
		skyFill,
		applyTimeOfDay(tod: TimeOfDayState): number {
			fog.color.copy(tod.fogColor);
			fog.density = tod.fogDensity;
			state.fogDensity = tod.fogDensity;
			state.fogCutoffM = fogVisibilityDistance(tod.fogDensity);

			moonLight.color.copy(tod.celestialColor);
			moonLight.intensity = tod.celestialIntensity * DIRECTIONAL_PHYSICAL_SCALE;
			moonLight.position
				.copy(tod.celestialDir)
				.multiplyScalar(CELESTIAL_LIGHT_DISTANCE_M);

			skyFill.color.copy(tod.hemiSky);
			skyFill.groundColor.copy(tod.hemiGround);
			skyFill.intensity = tod.hemiIntensity * HEMI_PHYSICAL_SCALE;

			return state.fogCutoffM;
		},
	};

	return state;
}
