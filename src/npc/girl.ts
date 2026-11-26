import {
	BoxGeometry,
	CylinderGeometry,
	ExtrudeGeometry,
	Group,
	Mesh,
	MeshStandardMaterial,
	Shape,
	SphereGeometry,
	Vector3,
} from "three";

const sphere = new SphereGeometry(1, 12, 8);
const limb = new CylinderGeometry(1, 1, 1, 8);
const box = new BoxGeometry();

function cloth(color: number) {
	return new MeshStandardMaterial({
		color,
		emissive: color,
		emissiveIntensity: 0.35,
		roughness: 0.9,
	});
}

const skin = cloth(0xa5735a);
const hair = cloth(0x36221d);
const coat = cloth(0x424442);
const scarf = cloth(0x975b66);
const blanket = cloth(0x555f44);
const socks = cloth(0x494048);
const up = new Vector3(0, 1, 0);

type Seat = { readonly x: number; readonly y: number; readonly z: number };

export function createGirl(seat: Seat) {
	const girl = new Group();
	girl.name = "Seated girl greybox";
	girl.position.set(seat.x, seat.y, seat.z);
	// Local +Z faces the aisle. Turn the seated pose partway toward the window (−X).
	girl.rotation.y = -Math.PI / 10;

	function oval(
		parent: Group,
		material: MeshStandardMaterial,
		x: number,
		y: number,
		z: number,
		w: number,
		h: number,
		d: number,
	) {
		const mesh = new Mesh(sphere, material);
		mesh.position.set(x, y, z);
		mesh.scale.set(w, h, d);
		parent.add(mesh);
		return mesh;
	}

	function segment(
		material: MeshStandardMaterial,
		x: number,
		y1: number,
		z1: number,
		y2: number,
		z2: number,
		radius: number,
	) {
		const mesh = new Mesh(limb, material);
		const dy = y2 - y1;
		const dz = z2 - z1;
		mesh.position.set(x, (y1 + y2) / 2, (z1 + z2) / 2);
		mesh.scale.set(radius, Math.hypot(dy, dz), radius);
		mesh.quaternion.setFromUnitVectors(up, new Vector3(0, dy, dz).normalize());
		girl.add(mesh);
	}

	const torso = oval(girl, coat, 0, 0.24, 0, 0.19, 0.22, 0.115);
	torso.rotation.x = -0.1;
	for (const x of [-0.14, 0.14]) {
		segment(coat, x, 0.35, -0.018, 0.135, 0.15, 0.055);
		oval(girl, skin, x * 0.8, 0.149, 0.21, 0.043, 0.027, 0.066);
	}
	oval(girl, scarf, 0, 0.438, 0.007, 0.123, 0.065, 0.105);
	const scarfEnd = new Mesh(box, scarf);
	scarfEnd.position.set(0.048, 0.31, 0.099);
	scarfEnd.scale.set(0.078, 0.19, 0.023);
	scarfEnd.rotation.z = -0.14;
	girl.add(scarfEnd);

	const head = new Group();
	head.position.set(0, 0.545, -0.019);
	head.rotation.y = 0.13;
	girl.add(head);
	oval(head, skin, 0, 0, 0.013, 0.081, 0.11, 0.08);
	oval(head, skin, 0, -0.016, 0.088, 0.018, 0.024, 0.019);
	oval(head, hair, 0, 0.044, -0.022, 0.093, 0.093, 0.083);
	oval(head, hair, 0, -0.035, -0.1, 0.056, 0.052, 0.047);

	for (const x of [-0.092, 0.092]) {
		segment(coat, x, 0.103, 0.035, 0.022, 0.36, 0.081);
		oval(girl, skin, x, 0.004, 0.369, 0.061, 0.077, 0.068);
		segment(skin, x, 0.015, 0.369, -0.39, 0.495, 0.053);
		segment(socks, x, -0.3, 0.466, -0.514, 0.535, 0.047);
		oval(girl, socks, x, -0.525, 0.577, 0.057, 0.04, 0.098);
	}

	// Extrude the folded profile across her lap. The front edge hangs over the knees.
	const profile = new Shape();
	profile.moveTo(-0.105, 0.16);
	profile.quadraticCurveTo(0, 0.2, 0.12, 0.184);
	profile.lineTo(0.31, 0.114);
	profile.quadraticCurveTo(0.41, 0.114, 0.401, 0.05);
	profile.lineTo(0.39, -0.029);
	profile.lineTo(0.319, 0.042);
	profile.lineTo(0.073, 0.065);
	profile.lineTo(-0.105, 0.015);
	profile.closePath();
	const wrap = new Mesh(
		new ExtrudeGeometry(profile, {
			depth: 0.396,
			bevelEnabled: true,
			bevelSegments: 1,
			bevelSize: 0.012,
			bevelThickness: 0.012,
		}),
		blanket,
	);
	wrap.position.x = 0.198;
	wrap.rotation.y = -Math.PI / 2;
	girl.add(wrap);

	return girl;
}
