const STEP_SECONDS = 1 / 60;
const MAX_STEPS = 2;

export interface FrameClock {
	request(callback: (timestampMs: number) => void): number;
	cancel(id: number): void;
}

export interface Visibility {
	readonly hidden: boolean;
	addEventListener(type: "visibilitychange", listener: () => void): void;
	removeEventListener(type: "visibilitychange", listener: () => void): void;
}

const browserClock: FrameClock = {
	request: (callback) => requestAnimationFrame(callback),
	cancel: (id) => cancelAnimationFrame(id),
};

export function startLoop(
	update: (stepSeconds: number) => void,
	render: (alpha: number) => void,
	clock: FrameClock = browserClock,
	visibility: Visibility = document,
): () => void {
	let lastTimestamp: number | undefined;
	let accumulator = 0;
	let frameId: number | undefined;
	let stopped = false;

	function schedule() {
		if (!stopped && !visibility.hidden && frameId === undefined) {
			frameId = clock.request(frame);
		}
	}

	function frame(timestamp: number) {
		frameId = undefined;
		if (stopped || visibility.hidden) return;

		if (lastTimestamp !== undefined) {
			const elapsed = Math.max(0, (timestamp - lastTimestamp) / 1_000);
			accumulator = Math.min(accumulator + elapsed, STEP_SECONDS * MAX_STEPS);
		}
		lastTimestamp = timestamp;

		while (accumulator >= STEP_SECONDS) {
			accumulator -= STEP_SECONDS;
			update(STEP_SECONDS);
			if (stopped || visibility.hidden) return;
		}
		render(accumulator / STEP_SECONDS);
		schedule();
	}

	function resetFrame() {
		if (frameId !== undefined) clock.cancel(frameId);
		frameId = undefined;
		lastTimestamp = undefined;
		accumulator = 0;
	}

	function onVisibilityChange() {
		resetFrame();
		schedule();
	}

	visibility.addEventListener("visibilitychange", onVisibilityChange);
	schedule();

	return () => {
		stopped = true;
		visibility.removeEventListener("visibilitychange", onVisibilityChange);
		resetFrame();
	};
}
