import {
	BoxGeometry,
	Group,
	InstancedMesh,
	Mesh,
	MeshStandardMaterial,
	Object3D,
} from "three";

const unitBox = new BoxGeometry();
const rackHeight = 1.48;
const rackDepth = 0.34;
/** Default span along the compartment wall (the walkable carriage's rooms). */
const DEFAULT_SPAN = { startX: -1.31, endX: -0.16 } as const;
const tube = 0.03;

const brass = new MeshStandardMaterial({
	color: 0xc9a25e,
	metalness: 0.3,
	roughness: 0.35,
	emissive: 0x4a3518,
});
const wire = new MeshStandardMaterial({
	color: 0x8c704b,
	metalness: 0.35,
	roughness: 0.5,
	emissive: 0x302317,
});
const leather = new MeshStandardMaterial({
	color: 0x5c3522,
	roughness: 0.6,
	emissive: 0x392316,
});
const straps = new MeshStandardMaterial({
	color: 0x402c22,
	emissive: 0x2a1c14,
});

export function createLuggageRack(
	wallZ: number,
	toward: 1 | -1,
	luggage?: "suitcases" | "holdall",
	span: { readonly startX: number; readonly endX: number } = DEFAULT_SPAN,
) {
	const rackStartX = span.startX;
	const rackEndX = span.endX;
	const rackLength = rackEndX - rackStartX;
	const rackMidX = (rackStartX + rackEndX) / 2;
	const rack = new Group();
	rack.position.set(0, rackHeight, wallZ);
	const front = toward * rackDepth;
	const centre = front / 2;

	function part(
		material: MeshStandardMaterial,
		x: number,
		y: number,
		z: number,
		w: number,
		h: number,
		d: number,
	) {
		const mesh = new Mesh(unitBox, material);
		mesh.position.set(x, y, z);
		mesh.scale.set(w, h, d);
		rack.add(mesh);
		return mesh;
	}

	part(brass, rackMidX, 0, front, rackLength, tube, tube);
	for (const x of [rackStartX, rackEndX]) {
		part(brass, x, -tube / 4, centre, tube, tube / 2, rackDepth);
	}
	const supportZ = front - toward * 0.04;
	for (const x of [rackStartX + 0.06, rackEndX - 0.06]) {
		const bracket = part(
			brass,
			x,
			-0.15,
			supportZ / 2,
			tube * 0.7,
			tube * 0.7,
			Math.hypot(0.3, supportZ),
		);
		bracket.rotation.x = Math.atan2(-0.3, supportZ);
	}

	const barY = -0.14;
	const barZ = front - toward * 0.03;
	const barDiameter = (tube * 2) / 3;
	part(
		brass,
		rackMidX,
		barY,
		barZ,
		rackLength - 0.08,
		barDiameter,
		barDiameter,
	);
	for (const x of [rackStartX + 0.04, rackEndX - 0.04]) {
		part(brass, x, barY / 2, barZ, barDiameter, -barY, barDiameter);
	}

	// Crossed wires fill the shelf in one draw, with a view through the gaps.
	const across = 22;
	const lengthwise = 6;
	const gauge = 0.004;
	const mesh = new InstancedMesh(unitBox, wire, across + lengthwise);
	const strand = new Object3D();
	for (let i = 0; i < across; i++) {
		strand.position.set(
			rackStartX + (rackLength * (i + 1)) / (across + 1),
			-gauge,
			centre,
		);
		strand.scale.set(gauge, gauge, rackDepth);
		strand.updateMatrix();
		mesh.setMatrixAt(i, strand.matrix);
	}
	for (let i = 0; i < lengthwise; i++) {
		strand.position.set(rackMidX, 0, (front * (i + 1)) / (lengthwise + 1));
		strand.scale.set(rackLength, gauge, gauge);
		strand.updateMatrix();
		mesh.setMatrixAt(across + i, strand.matrix);
	}
	rack.add(mesh);

	function bag(
		x: number,
		base: number,
		z: number,
		w: number,
		h: number,
		d: number,
	) {
		part(leather, x, base + h / 2, toward * z, w, h, d);
		for (const offset of [-w * 0.34, w * 0.34]) {
			part(
				straps,
				x + offset,
				base + h / 2,
				toward * z,
				0.033,
				h + 0.008,
				d + 0.008,
			);
		}
		const frontZ = toward * (z + d / 2);
		part(straps, x, base + h * 0.62, frontZ, 0.12, 0.024, 0.036);
	}

	if (luggage === "suitcases") {
		bag(rackMidX - 0.085, 0, 0.145, 0.8, 0.19, 0.23);
		bag(rackMidX - 0.09, 0.19, 0.145, 0.65, 0.16, 0.19);
	} else if (luggage === "holdall") {
		bag(rackMidX - 0.175, 0, 0.165, 0.58, 0.27, 0.27);
	}
	return rack;
}
