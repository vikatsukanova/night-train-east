import "./interact.css";

import type { Point } from "./collision";

export type Interactable = Point & {
	prompt(at: Point): string | undefined;
	toggle(at: Point): void;
};

export function nearestInteractable(
	position: Point,
	yaw: number,
	candidates: readonly Interactable[],
) {
	const forwardX = -Math.sin(yaw);
	const forwardZ = -Math.cos(yaw);
	let nearest: Interactable | undefined;
	let distanceLimit = 1.2;

	for (const candidate of candidates) {
		const dx = candidate.x - position.x;
		const dz = candidate.z - position.z;
		const distance = Math.hypot(dx, dz);
		if (
			distance > distanceLimit ||
			dx * forwardX + dz * forwardZ <= distance * 0.5
		)
			continue;
		if (!candidate.prompt(position)) continue;
		nearest = candidate;
		distanceLimit = distance;
	}
	return nearest;
}

export function createInteractionPrompt(container: HTMLElement) {
	const label = document.createElement("p");
	label.className = "interaction-prompt";
	container.append(label);
	return (action?: string) => {
		const text = action ? `E  ${action}` : "";
		if (label.textContent !== text) label.textContent = text;
		label.hidden = !action;
	};
}
