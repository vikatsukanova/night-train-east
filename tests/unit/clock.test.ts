import { describe, expect, it } from "vitest";
import {
	DEFAULT_DURATION_SEC,
	DEFAULT_SPEED_KMH,
	formatTimeOfDay,
	RouteClock,
} from "../../src/core/clock";

describe("RouteClock", () => {
	it("integrates distance accurately across fixed steps at constant speed", () => {
		const clock = new RouteClock();
		const dt = 1 / 60;
		const steps = 600; // 10 seconds

		for (let i = 0; i < steps; i++) {
			clock.advance(dt);
		}

		expect(clock.rideT).toBeCloseTo(10, 6);
		expect(clock.speedMps).toBeCloseTo(DEFAULT_SPEED_KMH / 3.6, 6);
		expect(clock.distanceM).toBeCloseTo((DEFAULT_SPEED_KMH / 3.6) * 10, 4);
	});

	it("maps rideT 0 to 18:30 and rideT 1500 to 05:10, holding after durationSec", () => {
		const clock = new RouteClock();

		expect(clock.timeOfDayHours).toBeCloseTo(18.5, 6);
		expect(formatTimeOfDay(clock.timeOfDayHours)).toBe("18:30");

		// Midpoint: 18:30 + 5h 20m = 23:50
		clock.setRideT(DEFAULT_DURATION_SEC / 2);
		expect(clock.timeOfDayHours).toBeCloseTo(23 + 50 / 60, 6);
		expect(formatTimeOfDay(clock.timeOfDayHours)).toBe("23:50");

		// End of ride: 05:10
		clock.setRideT(DEFAULT_DURATION_SEC);
		expect(clock.timeOfDayHours).toBeCloseTo(5 + 10 / 60, 6);
		expect(formatTimeOfDay(clock.timeOfDayHours)).toBe("05:10");

		// Past end of ride: story clock holds at 05:10 while distance keeps scrolling
		const distAtEnd = clock.distanceM;
		clock.advance(60);
		expect(clock.timeOfDayHours).toBeCloseTo(5 + 10 / 60, 6);
		expect(clock.distanceM).toBeGreaterThan(distAtEnd);
	});

	it("supports setRideT deterministically and clamps negative values", () => {
		const stepped = new RouteClock();
		for (let i = 0; i < 3600; i++) stepped.advance(1 / 60);

		const jumped = new RouteClock();
		jumped.setRideT(60);

		expect(jumped.distanceM).toBeCloseTo(stepped.distanceM, 5);
		expect(jumped.timeOfDayHours).toBeCloseTo(stepped.timeOfDayHours, 6);

		jumped.setRideT(-25);
		expect(jumped.rideT).toBe(0);
		expect(jumped.distanceM).toBe(0);
	});

	it("integrates piecewise per-segment speeds", () => {
		const clock = new RouteClock({
			segments: [
				{ atSec: 0, speedKmh: 72 }, // 20 m/s for 100 s = 2000 m
				{ atSec: 100, speedKmh: 36 }, // 10 m/s for 50 s = 500 m
			],
		});

		clock.setRideT(150);
		expect(clock.speedMps).toBeCloseTo(10, 6);
		expect(clock.distanceM).toBeCloseTo(2500, 6);
		expect(clock.distanceAt(50)).toBeCloseTo(1000, 6);
	});
});
