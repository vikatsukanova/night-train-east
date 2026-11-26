import { compartments, dividerLeft, innerWall } from "./layout";

const PARTITION_HALF_THICKNESS = 0.055;
const DOORWAY_DEPTH_M = 0.54;
const DOORWAY_REVEAL_M = 0.1;
const WINDOW_HALF_WIDTH_M = 0.5;
const EYE_HEIGHT_M = 1.36;
const EYE_LEFT_OF_WINDOW_CENTRE_M = 0.18;
const AIM_RIGHT_OF_WINDOW_CENTRE_M = 0.17;
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
	leftWallZ: firstRoom.end - PARTITION_HALF_THICKNESS,
	rightWallZ: firstRoom.start + PARTITION_HALF_THICKNESS,
	leftBerth: firstRoom.bunks,
	rightBerth: firstRoom.facingBunks,
	doorX: dividerLeft + DOORWAY_DEPTH_M,
	doorHalfWidth: 0.69,
	ceiling: 2.06,
};

export const berthTopM = 0.57;

export const compartmentView = {
	eye: {
		x: compartmentLayout.doorX - DOORWAY_REVEAL_M,
		y: EYE_HEIGHT_M,
		z: windowCentreZ + EYE_LEFT_OF_WINDOW_CENTRE_M,
	},
	focus: {
		x: compartmentLayout.window.x,
		y: compartmentLayout.window.bottom + AIM_ABOVE_SILL_M,
		z: windowCentreZ - AIM_RIGHT_OF_WINDOW_CENTRE_M,
	},
};

export const compartmentSeat = {
	x: compartmentLayout.window.x + 0.43,
	y: berthTopM,
	z: compartmentLayout.rightWallZ + 0.18,
};
