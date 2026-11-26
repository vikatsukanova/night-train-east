import {
	BoxGeometry,
	CylinderGeometry,
	ExtrudeGeometry,
	Group,
	Mesh,
	MeshStandardMaterial,
	Path,
	PointLight,
	Shape,
} from "three";
import { berthTopM, compartmentLayout as layout } from "./compartmentLayout";
import { type Box, box, halfWidth, rectangle } from "./layout";
import { createLuggageRack } from "./luggageRack";

const unitBox = new BoxGeometry();
const WINDOW_CORNER_RADIUS_M = 0.08;
const RACK_LENGTH_M = 1.6;
const TABLE_HALF_WIDTH_M = 0.4;
const lampshadeGeometry = new CylinderGeometry(0.047, 0.077, 0.15, 12);

function finish(color: number, emissiveIntensity = 0.4) {
	return new MeshStandardMaterial({
		color,
		emissive: color,
		emissiveIntensity,
		roughness: 0.75,
	});
}

const wall = finish(0x895b42);
const wood = finish(0x592f23);
const trim = finish(0xa57750);
const gasket = finish(0x47291c);
const floor = finish(0x332b31);
const cream = finish(0xc1a287);
const upholstery = finish(0x49605b);
const brass = finish(0xb78a4a);
const shade = finish(0xffe0a0, 1.8);

function roundedRect(
	path: Path,
	left: number,
	right: number,
	bottom: number,
	top: number,
	radius: number,
) {
	path.moveTo(left + radius, bottom);
	path.lineTo(right - radius, bottom);
	path.quadraticCurveTo(right, bottom, right, bottom + radius);
	path.lineTo(right, top - radius);
	path.quadraticCurveTo(right, top, right - radius, top);
	path.lineTo(left + radius, top);
	path.quadraticCurveTo(left, top, left, top - radius);
	path.lineTo(left, bottom + radius);
	path.quadraticCurveTo(left, bottom, left + radius, bottom);
	path.closePath();
}

export function createCompartment() {
	const room = new Group();
	room.name = "M1 compartment";
	const {
		window,
		rightWallZ,
		leftWallZ,
		leftBerth,
		rightBerth,
		doorX,
		doorHalfWidth,
		ceiling,
	} = layout;

	function block(material: MeshStandardMaterial, bounds: Box) {
		const { minX, maxX, minY, maxY, minZ, maxZ } = bounds;
		const mesh = new Mesh(unitBox, material);
		mesh.position.set((minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2);
		mesh.scale.set(maxX - minX, maxY - minY, maxZ - minZ);
		room.add(mesh);
	}

	const footprint = rectangle(
		-halfWidth,
		doorX + 0.08,
		rightWallZ - 0.08,
		leftWallZ + 0.08,
	);
	block(floor, box(footprint, -0.14, 0));
	block(cream, box(footprint, ceiling, ceiling + 0.1));
	for (const z of [rightWallZ - 0.04, leftWallZ + 0.04]) {
		const wallBounds = rectangle(window.x, doorX, z - 0.04, z + 0.04);
		block(wall, box(wallBounds, 0, ceiling));
		const liningZ = z < window.centreZ ? z + 0.04 : z - 0.04;
		const lining = rectangle(window.x, doorX, liningZ - 0.012, liningZ + 0.012);
		block(wood, box(lining, 0.31, 0.87));
	}

	const { centreZ } = window;
	const doorLeft = centreZ + doorHalfWidth;
	const doorRight = centreZ - doorHalfWidth;
	const doorHeaderY = 1.98;
	block(
		wood,
		box(rectangle(doorX, doorX + 0.08, rightWallZ, doorRight), 0, ceiling),
	);
	block(
		wood,
		box(rectangle(doorX, doorX + 0.08, doorLeft, leftWallZ), 0, ceiling),
	);
	block(
		wood,
		box(
			rectangle(doorX, doorX + 0.08, doorRight, doorLeft),
			doorHeaderY,
			ceiling,
		),
	);
	for (const z of [doorRight, doorLeft]) {
		block(
			trim,
			box(
				rectangle(doorX - 0.06, doorX + 0.08, z - 0.022, z + 0.022),
				0,
				doorHeaderY,
			),
		);
	}

	// Extrude from the same wall plane as the original carriage. The rounded
	// opening stays clear for the scenery and leaves room for a future glass pane.
	const halfOpening = (window.maxZ - window.minZ) / 2;
	function windowLayer(
		outline: Shape,
		material: MeshStandardMaterial,
		x: number,
		depth: number,
	) {
		const opening = new Path();
		roundedRect(
			opening,
			-halfOpening,
			halfOpening,
			window.bottom,
			window.top,
			WINDOW_CORNER_RADIUS_M,
		);
		outline.holes.push(opening);
		const geometry = new ExtrudeGeometry(outline, {
			depth,
			bevelEnabled: false,
			curveSegments: 6,
		});
		const mesh = new Mesh(geometry, material);
		// Local +Z extrudes toward the cabin and local +X points to camera-right.
		mesh.rotation.y = Math.PI / 2;
		mesh.position.set(x, 0, centreZ);
		room.add(mesh);
	}

	const windowWall = new Shape();
	windowWall.moveTo(centreZ - leftWallZ, 0);
	windowWall.lineTo(centreZ - rightWallZ, 0);
	windowWall.lineTo(centreZ - rightWallZ, ceiling);
	windowWall.lineTo(centreZ - leftWallZ, ceiling);
	windowWall.closePath();
	windowLayer(windowWall, wall, -halfWidth, halfWidth + window.x);

	const frame = new Shape();
	const frameWidth = 0.075;
	roundedRect(
		frame,
		-halfOpening - frameWidth,
		halfOpening + frameWidth,
		window.bottom - frameWidth,
		window.top + frameWidth,
		0.12,
	);
	windowLayer(frame, trim, window.x, 0.04);

	const seal = new Shape();
	const sealWidth = 0.021;
	roundedRect(
		seal,
		-halfOpening - sealWidth,
		halfOpening + sealWidth,
		window.bottom - sealWidth,
		window.top + sealWidth,
		0.1,
	);
	windowLayer(seal, gasket, window.x + 0.04, 0.012);

	const sashY = window.bottom + (window.top - window.bottom) * 0.69;
	block(
		trim,
		box(
			rectangle(window.x + 0.02, window.x + 0.055, window.minZ, window.maxZ),
			sashY - 0.026,
			sashY + 0.026,
		),
	);
	block(
		wood,
		box(
			rectangle(window.x, window.x + 0.018, rightWallZ, leftWallZ),
			0,
			window.bottom - 0.08,
		),
	);
	block(
		wood,
		box(
			rectangle(window.x, window.x + 0.1, rightWallZ, leftWallZ),
			ceiling - 0.15,
			ceiling,
		),
	);

	const table = rectangle(
		window.x,
		window.x + 0.5,
		// Nearly reaches the berth edges, so a seated passenger's legs go under it.
		centreZ - TABLE_HALF_WIDTH_M,
		centreZ + TABLE_HALF_WIDTH_M,
	);
	block(trim, box(table, 0.755, 0.775));
	block(wood, box(table, 0.775, 0.81));
	const hinge = rectangle(
		window.x + 0.02,
		window.x + 0.1,
		centreZ - 0.17,
		centreZ + 0.17,
	);
	block(gasket, box(hinge, 0.59, 0.755));

	for (const berth of [leftBerth, rightBerth]) {
		block(wood, box(berth, 0.35, 0.45));
		block(upholstery, box(berth, 0.45, berthTopM));
	}
	// Racks are centred on the end walls, between the window wall and the doorway.
	const wallMidX = (window.x + doorX - 0.06) / 2;
	const rackSpan = {
		startX: wallMidX - RACK_LENGTH_M / 2,
		endX: wallMidX + RACK_LENGTH_M / 2,
	};
	room.add(
		createLuggageRack(leftWallZ, -1, "suitcases", rackSpan),
		createLuggageRack(rightWallZ, 1, "suitcases", rackSpan),
	);

	// A wall lamp either side of the window, mirrored about its centre.
	// Centred in the wall space between the window frame and the end wall, and
	// low enough to clear the luggage-rack brackets above.
	const frameEdge = window.maxZ - centreZ + 0.075;
	const lampOffset = (frameEdge + (leftWallZ - centreZ)) / 2;
	const lampX = window.x + 0.12;
	const lampY = 1.22;
	for (const lampZ of [centreZ - lampOffset, centreZ + lampOffset]) {
		block(
			brass,
			box(
				rectangle(window.x, window.x + 0.023, lampZ - 0.06, lampZ + 0.06),
				lampY - 0.18,
				lampY + 0.1,
			),
		);
		block(
			brass,
			box(
				rectangle(window.x + 0.022, lampX + 0.02, lampZ - 0.015, lampZ + 0.015),
				lampY - 0.118,
				lampY - 0.092,
			),
		);
		const lampshade = new Mesh(lampshadeGeometry, shade);
		lampshade.position.set(lampX, lampY, lampZ);
		const light = new PointLight(0xffbb7c, 0.75, 1.7);
		light.position.set(lampX + 0.04, lampY, lampZ);
		room.add(lampshade, light);
	}

	return room;
}
