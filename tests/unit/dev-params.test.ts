import { describe, expect, it } from "vitest";
import { parseDevParams } from "../../src/dev/params";

describe("parseDevParams", () => {
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
