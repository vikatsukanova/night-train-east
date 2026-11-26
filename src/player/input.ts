const keys = new Set([
	"KeyW",
	"KeyA",
	"KeyS",
	"KeyD",
	"ShiftLeft",
	"ShiftRight",
	"KeyE",
]);

export function createInput(
	canvas: HTMLCanvasElement,
	onLockChange: (locked: boolean) => void,
) {
	const pressed = new Set<string>();
	let dx = 0;
	let dy = 0;
	let interact = false;
	let requesting = false;
	const locked = () =>
		document.pointerLockElement === canvas && !document.hidden;

	function clear() {
		pressed.clear();
		dx = dy = 0;
		interact = false;
	}

	function lockChanged() {
		requesting = false;
		clear();
		if (document.hidden && document.pointerLockElement === canvas)
			document.exitPointerLock();
		onLockChange(locked());
	}

	document.addEventListener("pointerlockchange", lockChanged);
	document.addEventListener("pointerlockerror", () => {
		requesting = false;
	});
	document.addEventListener("visibilitychange", lockChanged);
	window.addEventListener("blur", clear);

	document.addEventListener("keydown", (event) => {
		if (!locked() || !keys.has(event.code)) return;
		event.preventDefault();
		pressed.add(event.code);
		if (event.code === "KeyE" && !event.repeat) interact = true;
	});
	document.addEventListener("keyup", (event) => pressed.delete(event.code));
	document.addEventListener("mousemove", (event) => {
		if (!locked()) return;
		dx += event.movementX;
		dy += event.movementY;
	});

	async function capture() {
		if (locked() || requesting || document.hidden) return;
		requesting = true;
		try {
			await canvas.requestPointerLock();
		} catch {
			requesting = false;
		}
	}
	canvas.addEventListener("click", capture);

	return {
		locked,
		capture,
		read() {
			const input = {
				forward: Number(pressed.has("KeyW")) - Number(pressed.has("KeyS")),
				right: Number(pressed.has("KeyD")) - Number(pressed.has("KeyA")),
				fast: pressed.has("ShiftLeft") || pressed.has("ShiftRight"),
				dx,
				dy,
				interact,
			};
			dx = dy = 0;
			interact = false;
			return input;
		},
	};
}
