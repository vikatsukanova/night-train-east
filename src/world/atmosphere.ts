import {
	Color,
	DirectionalLight,
	FogExp2,
	HemisphereLight,
	type Scene,
} from "three";

export interface NightAtmosphere {
	readonly fogColor: Color;
	readonly fogDensity: number;
	readonly fogCutoffM: number;
	readonly moonLight: DirectionalLight;
	readonly skyFill: HemisphereLight;
}

/** Deep midnight indigo fog colour tuned to docs/reference/m1-cozy-cabin.jpg & RENDERING §4.2. */
export const NIGHT_FOG_COLOR_HEX = 0x0d1b30;
export const NIGHT_FOG_DENSITY = 0.0085;

/**
 * Distance at which Three.js FogExp2 reaches (1 - transmittanceThreshold) opacity:
 *   exp(-(density * d)^2) = threshold  =>  d = sqrt(-ln(threshold)) / density
 */
export function fogVisibilityDistance(
	density: number,
	transmittanceThreshold = 0.015,
): number {
	if (density <= 0) return Number.POSITIVE_INFINITY;
	return Math.sqrt(-Math.log(transmittanceThreshold)) / density;
}

/**
 * Applies M1 night atmosphere (deep blue fog/background, cold moonlight directional + sky fill).
 */
export function applyNightAtmosphere(scene: Scene): NightAtmosphere {
	const fogColor = new Color(NIGHT_FOG_COLOR_HEX);
	scene.background = fogColor;
	scene.fog = new FogExp2(fogColor, NIGHT_FOG_DENSITY);

	// Cold moonlight angled from high-left-ahead so the window-facing birch trunks catch
	// bright silver-white moonlit edges while their far sides fall into deep indigo shadow.
	const moonLight = new DirectionalLight(0x9bc4f7, 1.85);
	moonLight.position.set(-34, 34, -22);

	// Cool indigo sky & moonlit snow bounce fill so snowbanks stay luminous and spruces keep depth.
	const skyFill = new HemisphereLight(0x3a5d94, 0x203554, 1.05);

	scene.add(skyFill, moonLight);

	return {
		fogColor,
		fogDensity: NIGHT_FOG_DENSITY,
		fogCutoffM: fogVisibilityDistance(NIGHT_FOG_DENSITY),
		moonLight,
		skyFill,
	};
}
