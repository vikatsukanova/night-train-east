import { describe, expect, it, vi } from "vitest";
import { EventBus } from "../../src/core/events";

interface RideEvents {
	departed: { carriage: number };
	stopped: undefined;
}

describe("EventBus", () => {
	it("dispatches the typed payload only to current listeners for that event", () => {
		const bus = new EventBus<RideEvents>();
		const listener = vi.fn();
		const stopListener = vi.fn();
		const unsubscribe = bus.on("departed", listener);
		bus.on("stopped", stopListener);

		bus.emit("departed", { carriage: 2 });
		unsubscribe();
		unsubscribe();
		bus.emit("departed", { carriage: 3 });
		bus.emit("stopped", undefined);

		expect(listener.mock.calls).toEqual([[{ carriage: 2 }]]);
		expect(stopListener).toHaveBeenCalledOnce();
	});

	it("applies removals immediately and additions on the next emit", () => {
		const bus = new EventBus<RideEvents>();
		const removed = vi.fn();
		const added = vi.fn();
		const unsubscribe = bus.on("stopped", () => {
			remove();
			bus.on("stopped", added);
		});
		const remove = bus.on("stopped", removed);

		bus.emit("stopped", undefined);
		expect(removed).not.toHaveBeenCalled();
		expect(added).not.toHaveBeenCalled();

		unsubscribe();
		bus.emit("stopped", undefined);
		expect(added).toHaveBeenCalledOnce();
	});
});
