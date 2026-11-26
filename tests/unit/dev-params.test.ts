import { describe, expect, it } from "vitest";
import { formatTimeOfDay, RouteClock } from "../../src/core/clock";
import { parseDevParams } from "../../src/dev/params";

describe("parseDevParams", () => {
	it("initialises the default route at 22:45 for M1", () => {
		const params = parseDevParams("?moment=M1");
		const clock = new RouteClock({ initialRideT: params.rideT ?? 0 });
		expect(formatTimeOfDay(clock.timeOfDayHours)).toBe("22:45");
		expect(parseDevParams("?moment=M1&t=0").rideT).toBe(0);
		expect(parseDevParams("?moment=M1&t=invalid").rideT).toBe(params.rideT);
		expect(parseDevParams("?moment=M2").rideT).toBeUndefined();
	});

	it("parses valid ?t=, ?seed=, ?speed=, and ?nohud query parameters", () => {
		expect(parseDevParams("?t=600&seed=42&speed=600")).toEqual({
			rideT: 600,
			seed: 42,
			speedKmh: 600,
			hideOverlay: false,
		});

		expect(parseDevParams("?t=0&speed=0&nohud")).toEqual({
			rideT: 0,
			speedKmh: 0,
			hideOverlay: true,
		});
	});

	it("ignores missing, malformed, or negative numeric params safely", () => {
		expect(parseDevParams("")).toEqual({ hideOverlay: false });
		expect(parseDevParams("?t=-10&seed=abc&speed=NaN")).toEqual({
			hideOverlay: false,
		});
	});
});
