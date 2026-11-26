import { describe, expect, it, vi } from "vitest";
import { type FrameClock, startLoop } from "../../src/core/loop";

function createFrameDriver() {
	let nextId = 0;
	const pending = new Map<number, (timestamp: number) => void>();
	const clock: FrameClock = {
		request(callback) {
			const id = nextId++;
			pending.set(id, callback);
			return id;
		},
		cancel(id) {
			pending.delete(id);
		},
	};

	return {
		clock,
		pending,
		advance(timestamp: number) {
			for (const [id, callback] of [...pending]) {
				pending.delete(id);
				callback(timestamp);
			}
		},
	};
}

function createVisibility() {
	return Object.assign(new EventTarget(), { hidden: false });
}

describe("startLoop", () => {
	it("advances in fixed steps and discards excess catch-up after a stall", () => {
		const frames = createFrameDriver();
		const update = vi.fn();
		const render = vi.fn();
		const stop = startLoop(update, render, frames.clock, createVisibility());

		frames.advance(0);
		frames.advance(10);
		expect(update).not.toHaveBeenCalled();
		expect(render).toHaveBeenLastCalledWith(0.6);

		frames.advance(1_000);
		expect(update.mock.calls).toEqual([[1 / 60], [1 / 60]]);
		expect(render).toHaveBeenLastCalledWith(0);

		frames.advance(1_010);
		expect(update).toHaveBeenCalledTimes(2);
		frames.advance(1_020);
		expect(update).toHaveBeenCalledTimes(3);
		expect(render).toHaveBeenCalledTimes(5);

		stop();
		expect(frames.pending.size).toBe(0);
	});

	it("cancels while hidden and resumes without counting hidden time", () => {
		const frames = createFrameDriver();
		const visibility = createVisibility();
		const update = vi.fn();
		const render = vi.fn();
		const stop = startLoop(update, render, frames.clock, visibility);

		frames.advance(0);
		visibility.hidden = true;
		visibility.dispatchEvent(new Event("visibilitychange"));
		expect(frames.pending.size).toBe(0);
		frames.advance(4_000);
		expect(render).toHaveBeenCalledTimes(1);

		visibility.hidden = false;
		visibility.dispatchEvent(new Event("visibilitychange"));
		frames.advance(5_000);
		expect(update).not.toHaveBeenCalled();
		frames.advance(5_017);
		expect(update).toHaveBeenCalledOnce();
		stop();
	});
});
