import { Color, MathUtils, Vector3 } from "three";

export type LutMoodId = "dusk" | "night" | "dawn";

export interface TimeOfDayKeyframe {
	readonly hour: number;
	readonly skyZenithHex: number;
	readonly skyHorizonHex: number;
	readonly skyGlowHex: number;
	readonly fogColorHex: number;
	readonly fogDensity: number;
	readonly celestialElevDeg: number;
	readonly celestialAzimuthDeg: number;
	readonly celestialColorHex: number;
	readonly celestialIntensity: number;
	readonly celestialGlowStrength: number;
	readonly celestialGlowPower: number;
	readonly celestialDiscRadiusDeg: number;
	readonly isMoon: boolean;
	readonly hemiSkyHex: number;
	readonly hemiGroundHex: number;
	readonly hemiIntensity: number;
	readonly lampWeight: number;
	readonly windowBounceHex: number;
	readonly windowBounceIntensity: number;
	readonly exposure: number;
	readonly starVisibility: number;
	readonly snowColorHex: number;
	readonly snowIntensity: number;
	readonly lutId: LutMoodId;
}

export interface TimeOfDayState {
	hour: number;
	readonly skyZenith: Color;
	readonly skyHorizon: Color;
	readonly skyGlow: Color;
	readonly fogColor: Color;
	fogDensity: number;
	readonly celestialDir: Vector3;
	readonly celestialColor: Color;
	celestialIntensity: number;
	celestialGlowStrength: number;
	celestialGlowPower: number;
	celestialDiscRadiusDeg: number;
	moonFactor: number;
	readonly hemiSky: Color;
	readonly hemiGround: Color;
	hemiIntensity: number;
	lampWeight: number;
	readonly windowBounce: Color;
	windowBounceIntensity: number;
	exposure: number;
	starVisibility: number;
	readonly snowColor: Color;
	snowIntensity: number;
	lutFrom: LutMoodId;
	lutTo: LutMoodId;
	lutBlend: number;
}

/**
 * Reference Time-of-Day keyframes from docs/RENDERING.md §4.2.
 * Hours are continuous across midnight: 18:30 (18.5) → 22:45 (22.75) → 00:15 (24.25) → 05:10 (29.1667).
 */
export const TOD_KEYFRAMES: readonly TimeOfDayKeyframe[] = [
	{
		// M2: Dusk (18:30)
		hour: 18.5,
		skyZenithHex: 0x2c3e5e,
		skyHorizonHex: 0x5a6c85,
		skyGlowHex: 0xd99b7e,
		fogColorHex: 0x5d6a7a,
		fogDensity: 0.0022,
		celestialElevDeg: 2,
		celestialAzimuthDeg: -22,
		celestialColorHex: 0xffaa70,
		celestialIntensity: 1.2,
		celestialGlowStrength: 0.55,
		celestialGlowPower: 6,
		celestialDiscRadiusDeg: 1.8,
		isMoon: false,
		hemiSkyHex: 0x6b7d9e,
		hemiGroundHex: 0x383630,
		hemiIntensity: 0.7,
		lampWeight: 0.85,
		windowBounceHex: 0x7b8ca8,
		windowBounceIntensity: 0.55,
		exposure: 1.05,
		starVisibility: 0.1,
		snowColorHex: 0xc8c0c4,
		snowIntensity: 0.35,
		lutId: "dusk",
	},
	{
		// M1: Night (22:45) — reference moment
		hour: 22.75,
		skyZenithHex: 0x070d1b,
		skyHorizonHex: 0x162742,
		skyGlowHex: 0x2d4e80,
		fogColorHex: 0x112036,
		fogDensity: 0.0065,
		celestialElevDeg: 38,
		celestialAzimuthDeg: -32,
		celestialColorHex: 0x6b8fc7,
		celestialIntensity: 0.45,
		celestialGlowStrength: 0.24,
		celestialGlowPower: 14,
		celestialDiscRadiusDeg: 1.1,
		isMoon: true,
		hemiSkyHex: 0x1c3257,
		hemiGroundHex: 0x152033,
		hemiIntensity: 0.55,
		lampWeight: 1.0,
		windowBounceHex: 0x233b63,
		windowBounceIntensity: 0.35,
		exposure: 0.95,
		starVisibility: 1.0,
		snowColorHex: 0x8baad4,
		snowIntensity: 1.0,
		lutId: "night",
	},
	{
		// M4: Night Stop (00:15)
		hour: 24.25,
		skyZenithHex: 0x050a16,
		skyHorizonHex: 0x122038,
		skyGlowHex: 0x243e66,
		fogColorHex: 0x0f1d33,
		fogDensity: 0.0055,
		celestialElevDeg: 45,
		celestialAzimuthDeg: -42,
		celestialColorHex: 0x5e82bd,
		celestialIntensity: 0.4,
		celestialGlowStrength: 0.2,
		celestialGlowPower: 16,
		celestialDiscRadiusDeg: 1.05,
		isMoon: true,
		hemiSkyHex: 0x1a2e4f,
		hemiGroundHex: 0x202d42,
		hemiIntensity: 0.5,
		lampWeight: 1.0,
		windowBounceHex: 0x1f3559,
		windowBounceIntensity: 0.3,
		exposure: 1.0,
		starVisibility: 1.0,
		snowColorHex: 0x8baad4,
		snowIntensity: 1.0,
		lutId: "night",
	},
	{
		// M3: Dawn (05:10)
		hour: 29 + 10 / 60,
		skyZenithHex: 0x5d7aa6,
		skyHorizonHex: 0xffd1b3,
		skyGlowHex: 0xffbf94,
		fogColorHex: 0xd6b8b8,
		fogDensity: 0.0018,
		celestialElevDeg: 4,
		celestialAzimuthDeg: -18,
		celestialColorHex: 0xffbf94,
		celestialIntensity: 1.6,
		celestialGlowStrength: 0.65,
		celestialGlowPower: 5,
		celestialDiscRadiusDeg: 1.9,
		isMoon: false,
		hemiSkyHex: 0xc9a8b8,
		hemiGroundHex: 0x4a5870,
		hemiIntensity: 0.85,
		lampWeight: 0.45,
		windowBounceHex: 0xf5c6b3,
		windowBounceIntensity: 0.9,
		exposure: 1.12,
		starVisibility: 0.0,
		snowColorHex: 0xf7e1dc,
		snowIntensity: 0.25,
		lutId: "dawn",
	},
];

const colorScratchA = new Color();
const colorScratchB = new Color();

/** Unwraps a [0, 24) clock hour into the continuous dusk→dawn range [18.5, 29.1667]. */
export function unwrapRideHour(hour: number): number {
	if (!Number.isFinite(hour)) return 22.75;
	if (hour >= 18.5) return hour;
	if (hour < 12) return hour + 24;
	return hour;
}

export function createTimeOfDayState(): TimeOfDayState {
	return {
		hour: 22.75,
		skyZenith: new Color(),
		skyHorizon: new Color(),
		skyGlow: new Color(),
		fogColor: new Color(),
		fogDensity: 0.0065,
		celestialDir: new Vector3(-0.67, 0.62, -0.42).normalize(),
		celestialColor: new Color(),
		celestialIntensity: 0.45,
		celestialGlowStrength: 0.24,
		celestialGlowPower: 14,
		celestialDiscRadiusDeg: 1.1,
		moonFactor: 1,
		hemiSky: new Color(),
		hemiGround: new Color(),
		hemiIntensity: 0.55,
		lampWeight: 1,
		windowBounce: new Color(),
		windowBounceIntensity: 0.35,
		exposure: 0.95,
		starVisibility: 1,
		snowColor: new Color(),
		snowIntensity: 1,
		lutFrom: "night",
		lutTo: "night",
		lutBlend: 0,
	};
}

function lerpHex(target: Color, hexA: number, hexB: number, t: number): void {
	colorScratchA.setHex(hexA);
	colorScratchB.setHex(hexB);
	target.lerpColors(colorScratchA, colorScratchB, t);
}

function setDirectionFromAngles(
	target: Vector3,
	elevDeg: number,
	azimuthDeg: number,
): void {
	const elev = MathUtils.degToRad(elevDeg);
	const azim = MathUtils.degToRad(azimuthDeg);
	const cosElev = Math.cos(elev);
	// Compartment window faces -X; negative azimuth aims toward -Z (ahead / camera-right).
	target.set(
		-cosElev * Math.cos(azim),
		Math.sin(elev),
		cosElev * Math.sin(azim),
	);
	target.normalize();
}

/**
 * Evaluates the dusk→night→dawn atmosphere curve at `clockHours` (either wrapped [0, 24)
 * or continuous [18.5, 29.1667]) and writes into `target` with zero heap allocations.
 */
export function evaluateTimeOfDay(
	clockHours: number,
	target: TimeOfDayState = createTimeOfDayState(),
): TimeOfDayState {
	const first = TOD_KEYFRAMES[0];
	const last = TOD_KEYFRAMES[TOD_KEYFRAMES.length - 1];
	if (!first || !last) return target;

	const continuous = MathUtils.clamp(
		unwrapRideHour(clockHours),
		first.hour,
		last.hour,
	);
	let k0 = first;
	let k1 = last;
	for (let i = 0; i < TOD_KEYFRAMES.length - 1; i++) {
		const a = TOD_KEYFRAMES[i];
		const b = TOD_KEYFRAMES[i + 1];
		if (a && b && continuous >= a.hour && continuous <= b.hour) {
			k0 = a;
			k1 = b;
			break;
		}
	}

	const span = Math.max(1e-6, k1.hour - k0.hour);
	const u = MathUtils.clamp((continuous - k0.hour) / span, 0, 1);
	// Smooth cubic easing between keyframes; exact at every keyframe boundary.
	const t = u * u * (3 - 2 * u);

	target.hour = continuous;
	lerpHex(target.skyZenith, k0.skyZenithHex, k1.skyZenithHex, t);
	lerpHex(target.skyHorizon, k0.skyHorizonHex, k1.skyHorizonHex, t);
	lerpHex(target.skyGlow, k0.skyGlowHex, k1.skyGlowHex, t);
	lerpHex(target.fogColor, k0.fogColorHex, k1.fogColorHex, t);
	target.fogDensity = MathUtils.lerp(k0.fogDensity, k1.fogDensity, t);

	const elevDeg = MathUtils.lerp(k0.celestialElevDeg, k1.celestialElevDeg, t);
	const azimDeg = MathUtils.lerp(
		k0.celestialAzimuthDeg,
		k1.celestialAzimuthDeg,
		t,
	);
	setDirectionFromAngles(target.celestialDir, elevDeg, azimDeg);
	lerpHex(target.celestialColor, k0.celestialColorHex, k1.celestialColorHex, t);
	target.celestialIntensity = MathUtils.lerp(
		k0.celestialIntensity,
		k1.celestialIntensity,
		t,
	);
	target.celestialGlowStrength = MathUtils.lerp(
		k0.celestialGlowStrength,
		k1.celestialGlowStrength,
		t,
	);
	target.celestialGlowPower = MathUtils.lerp(
		k0.celestialGlowPower,
		k1.celestialGlowPower,
		t,
	);
	target.celestialDiscRadiusDeg = MathUtils.lerp(
		k0.celestialDiscRadiusDeg,
		k1.celestialDiscRadiusDeg,
		t,
	);
	target.moonFactor = MathUtils.lerp(k0.isMoon ? 1 : 0, k1.isMoon ? 1 : 0, t);

	lerpHex(target.hemiSky, k0.hemiSkyHex, k1.hemiSkyHex, t);
	lerpHex(target.hemiGround, k0.hemiGroundHex, k1.hemiGroundHex, t);
	target.hemiIntensity = MathUtils.lerp(k0.hemiIntensity, k1.hemiIntensity, t);
	target.lampWeight = MathUtils.lerp(k0.lampWeight, k1.lampWeight, t);
	lerpHex(target.windowBounce, k0.windowBounceHex, k1.windowBounceHex, t);
	target.windowBounceIntensity = MathUtils.lerp(
		k0.windowBounceIntensity,
		k1.windowBounceIntensity,
		t,
	);
	target.exposure = MathUtils.lerp(k0.exposure, k1.exposure, t);
	target.starVisibility = MathUtils.lerp(
		k0.starVisibility,
		k1.starVisibility,
		t,
	);
	lerpHex(target.snowColor, k0.snowColorHex, k1.snowColorHex, t);
	target.snowIntensity = MathUtils.lerp(k0.snowIntensity, k1.snowIntensity, t);
	if (k0.lutId === k1.lutId || t <= 0) {
		target.lutFrom = k0.lutId;
		target.lutTo = k0.lutId;
		target.lutBlend = 0;
	} else if (t >= 1) {
		target.lutFrom = k1.lutId;
		target.lutTo = k1.lutId;
		target.lutBlend = 0;
	} else {
		target.lutFrom = k0.lutId;
		target.lutTo = k1.lutId;
		target.lutBlend = t;
	}

	return target;
}
