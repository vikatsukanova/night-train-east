import { compartments, dividerLeft, innerWall, rectangle } from "./layout";

// Narrower than the walkable carriage's 2.25 m rooms, like a real kupe, so the
// table sits between the berth edges and her legs reach under it.
const ROOM_HALF_LENGTH_M = 0.95;
const BERTH_DEPTH_M = 0.485;
const DOORWAY_DEPTH_M = 0.54;
const DOORWAY_REVEAL_M = 0.1;
const WINDOW_HALF_WIDTH_M = 0.5;
const EYE_HEIGHT_M = 1.36;
const AIM_ABOVE_SILL_M = 0.08;

const [firstRoom] = compartments;
if (!firstRoom) throw new Error("Missing compartment layout.");
const windowCentreZ = (firstRoom.window.start + firstRoom.window.end) / 2;

// World axes match the carriage. Looking toward −X puts −Z on camera-right.
export const compartmentLayout = {
	window: {
		x: -innerWall,
		centreZ: windowCentreZ,
		minZ: windowCentreZ - WINDOW_HALF_WIDTH_M,
		maxZ: windowCentreZ + WINDOW_HALF_WIDTH_M,
		bottom: 0.92,
		top: 1.7,
	},
	leftWallZ: windowCentreZ + ROOM_HALF_LENGTH_M,
	rightWallZ: windowCentreZ - ROOM_HALF_LENGTH_M,
	leftBerth: rectangle(
		-innerWall,
		dividerLeft,
		windowCentreZ + ROOM_HALF_LENGTH_M - BERTH_DEPTH_M,
		windowCentreZ + ROOM_HALF_LENGTH_M,
	),
	rightBerth: rectangle(
		-innerWall,
		dividerLeft,
		windowCentreZ - ROOM_HALF_LENGTH_M,
		windowCentreZ - ROOM_HALF_LENGTH_M + BERTH_DEPTH_M,
	),
	doorX: dividerLeft + DOORWAY_DEPTH_M,
	doorHalfWidth: 0.69,
	ceiling: 2.06,
};

export const berthTopM = 0.57;

export const compartmentView = {
	eye: {
		x: compartmentLayout.doorX - DOORWAY_REVEAL_M,
		y: EYE_HEIGHT_M,
		// Centred on the window so the left and right halves mirror each other.
		z: windowCentreZ,
	},
	focus: {
		x: compartmentLayout.window.x,
		y: compartmentLayout.window.bottom + AIM_ABOVE_SILL_M,
		z: windowCentreZ,
	},
};

export const compartmentSeat = {
	// Close to the window so her shins and feet go under the table.
	x: compartmentLayout.window.x + 0.32,
	y: berthTopM,
	z: compartmentLayout.rightWallZ + 0.18,
};
