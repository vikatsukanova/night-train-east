import "./pause.css";

export function createPauseOverlay(container: HTMLElement, resume: () => void) {
	const overlay = document.createElement("button");
	overlay.type = "button";
	overlay.className = "pause-overlay";
	overlay.textContent = "Paused — click to continue";
	overlay.addEventListener("click", resume);
	container.append(overlay);
	return (paused: boolean) => {
		overlay.hidden = !paused;
	};
}
