import { describe, expect, it } from "vitest";
import { computeFramePercentiles } from "../../src/dev/overlay";
import { parseDevParams } from "../../src/dev/params";
import {
	getQualityPreset,
	parseQualityTier,
	QUALITY_PRESETS,
} from "../../src/render/quality";
import { evaluateTimeOfDay, unwrapRideHour } from "../../src/render/timeOfDay";
import {
	buildSnowInstanceData,
	createSnowVolume,
	isInsideCarriageAabb,
} from "../../src/render/weather";
import {
	FOG_CUTOFF_TRANSMITTANCE,
	fogVisibilityDistance,
	NIGHT_FOG_COLOR_HEX,
	NIGHT_FOG_DENSITY,
} from "../../src/world/atmosphere";

describe("timeOfDay", () => {
	it("reproduces exact RENDERING §4.2 values at M1 (22:45)", () => {
		const m1 = evaluateTimeOfDay(22.75);
		expect(m1.skyZenith.getHex()).toBe(0x070d1b);
		expect(m1.skyHorizon.getHex()).toBe(0x162742);
		expect(m1.fogColor.getHex()).toBe(NIGHT_FOG_COLOR_HEX);
		expect(m1.fogDensity).toBeCloseTo(NIGHT_FOG_DENSITY, 6);
		expect(m1.exposure).toBeCloseTo(0.95, 6);
		expect(m1.starVisibility).toBeCloseTo(1.0, 6);
		expect(m1.snowIntensity).toBeCloseTo(1.0, 6);
		expect(m1.lutFrom).toBe("night");
		expect(m1.lutTo).toBe("night");
	});

	it("transitions smoothly across dusk (18:30) → night (00:15) → dawn (05:10)", () => {
		const dusk = evaluateTimeOfDay(18.5);
		const midnightStop = evaluateTimeOfDay(0.25); // wrapped 00:15
		const dawn = evaluateTimeOfDay(5 + 10 / 60); // wrapped 05:10

		expect(unwrapRideHour(0.25)).toBeCloseTo(24.25, 6);
		expect(dusk.fogColor.getHex()).toBe(0x5d6a7a);
		expect(dusk.fogDensity).toBeCloseTo(0.0022, 6);
		expect(midnightStop.fogColor.getHex()).toBe(0x0f1d33);
		expect(midnightStop.fogDensity).toBeCloseTo(0.0055, 6);
		expect(dawn.fogColor.getHex()).toBe(0xd6b8b8);
		expect(dawn.fogDensity).toBeCloseTo(0.0018, 6);
		expect(dawn.starVisibility).toBe(0);
		expect(dawn.exposure).toBeCloseTo(1.12, 6);
	});
});

describe("fog cutoff", () => {
	it("matches RENDERING §3 (~300 m cutoff at 98% fog opacity for night 0.0065)", () => {
		const nightCutoffM = fogVisibilityDistance(
			NIGHT_FOG_DENSITY,
			FOG_CUTOFF_TRANSMITTANCE,
		);
		expect(nightCutoffM).toBeGreaterThan(295);
		expect(nightCutoffM).toBeLessThan(315);

		const duskCutoffM = fogVisibilityDistance(0.0022);
		expect(duskCutoffM).toBeGreaterThan(nightCutoffM);
	});
});

describe("snow volume and quality tiers", () => {
	it("uses documented quad counts per tier and disables bloom on Low and Medium", () => {
		expect(QUALITY_PRESETS.low.snowQuads).toBe(1200);
		expect(QUALITY_PRESETS.medium.snowQuads).toBe(3000);
		expect(QUALITY_PRESETS.high.snowQuads).toBe(6000);

		expect(QUALITY_PRESETS.low.bloom).toBe(false);
		expect(QUALITY_PRESETS.medium.bloom).toBe(false);
		expect(QUALITY_PRESETS.medium.maxWidth).toBe(1600);
		expect(QUALITY_PRESETS.medium.maxHeight).toBe(900);

		expect(parseQualityTier("LOW")).toBe("low");
		expect(parseQualityTier("med")).toBe("medium");
		expect(parseQualityTier("high")).toBe("high");
		expect(parseQualityTier("ultra")).toBeUndefined();
	});

	it("generates deterministic snow instance data in one instanced draw call", () => {
		const a = buildSnowInstanceData(120, 1986);
		const b = buildSnowInstanceData(120, 1986);
		const other = buildSnowInstanceData(120, 2026);

		expect(Array.from(a.seeds)).toEqual(Array.from(b.seeds));
		expect(Array.from(a.params)).toEqual(Array.from(b.params));
		expect(Array.from(a.seeds)).not.toEqual(Array.from(other.seeds));

		const volume = createSnowVolume({ quality: "medium", seed: 1986 });
		expect(volume.quadCount).toBe(getQualityPreset("medium").snowQuads);
		expect(volume.mesh.geometry.instanceCount).toBe(3000);
		volume.dispose();
	});

	it("excludes snow inside the carriage AABB while keeping exterior snow visible", () => {
		// Inside the compartment (eye, seat, window sill)
		expect(isInsideCarriageAabb(0.76, 1.36, -4.175)).toBe(true);
		expect(isInsideCarriageAabb(-1.4, 1.2, -4.2)).toBe(true);
		expect(isInsideCarriageAabb(0, 0.5, 0)).toBe(true);

		// Outside the window wall (|x| > 1.65) or above the roof (y >= 3.4)
		expect(isInsideCarriageAabb(-2.1, 1.4, -4.2)).toBe(false);
		expect(isInsideCarriageAabb(-8.0, 2.0, -20.0)).toBe(false);
		expect(isInsideCarriageAabb(0, 4.0, -4.2)).toBe(false);
	});
});

describe("dev perf instrumentation helpers", () => {
	it("parses quality and nopost query flags without changing default output", () => {
		expect(parseDevParams("?quality=low&nopost")).toEqual({
			quality: "low",
			noPost: true,
			hideOverlay: false,
		});
		expect(parseDevParams("?quality=invalid&post=1")).toEqual({
			hideOverlay: false,
		});
	});

	it("computes p50, p95, and max frame times accurately", () => {
		expect(computeFramePercentiles([], 0)).toEqual({
			p50: 0,
			p95: 0,
			max: 0,
			count: 0,
		});

		const samples = Array.from({ length: 100 }, (_, i) => i + 1);
		// Reverse order to ensure sorting does not rely on pre-sorted input.
		samples.reverse();
		const summary = computeFramePercentiles(samples, samples.length);
		expect(summary.count).toBe(100);
		expect(summary.p50).toBe(50);
		expect(summary.p95).toBe(95);
		expect(summary.max).toBe(100);
	});
});

describe("chunkMinViewDepth (fog cull by camera-space depth)", () => {
	it("measures depth along the view direction, not along the track", async () => {
		const { chunkMinViewDepth, CHUNK_BOUNDS_HALF_WIDTH_M } = await import(
			"../../src/world/scenery/chunkMath"
		);
		// Looking straight ahead (-Z): chunk 4 spans z in [-400, -320] → nearest depth 320.
		const ahead = { px: 0, py: 1.6, pz: 0, fx: 0, fy: 0, fz: -1 };
		expect(chunkMinViewDepth(4, 0, ahead)).toBeCloseTo(320);
		// Looking sideways (-X) out of the window: depth is bounded by the lateral extent,
		// so a far-along-track chunk is still close in view depth and must not be fog-culled.
		const side = { px: 0, py: 1.6, pz: 0, fx: -1, fy: 0, fz: 0 };
		expect(chunkMinViewDepth(4, 0, side)).toBeCloseTo(
			-CHUNK_BOUNDS_HALF_WIDTH_M,
		);
		// Chunks entirely behind the camera have negative depth (never fog-culled; frustum handles them).
		expect(chunkMinViewDepth(-2, 0, ahead)).toBeLessThan(0);
	});
});
