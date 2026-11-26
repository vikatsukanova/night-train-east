import {
	BoxGeometry,
	Color,
	ConeGeometry,
	DirectionalLight,
	FogExp2,
	HemisphereLight,
	Mesh,
	MeshStandardMaterial,
	PerspectiveCamera,
	PlaneGeometry,
	Scene,
} from "three";

export function createTestScene() {
	const scene = new Scene();
	const night = new Color(0x14243f);
	scene.background = night;
	scene.fog = new FogExp2(night, 0.033);

	const camera = new PerspectiveCamera(53, 1, 0.05, 100);
	camera.position.set(-1.32, 1.83, 1.5);
	camera.lookAt(1.3, 1.68, -0.28);

	const wall = new MeshStandardMaterial({ color: 0x81818a });
	const trim = new MeshStandardMaterial({ color: 0x4b4340 });
	const bench = new MeshStandardMaterial({ color: 0x51404b });
	const lamp = new MeshStandardMaterial({
		color: 0xffcb8c,
		emissive: 0xf9a450,
	});

	function box(
		material: MeshStandardMaterial,
		size: [number, number, number],
		position: [number, number, number],
	) {
		const mesh = new Mesh(new BoxGeometry(...size), material);
		mesh.position.set(...position);
		scene.add(mesh);
	}

	box(trim, [3, 0.16, 7], [0, 0, 0]); // Floor
	box(wall, [3, 0.14, 7], [0, 3.12, 0]); // Roof
	box(wall, [0.16, 3, 7], [-1.5, 1.56, 0]);
	box(wall, [3, 3, 0.15], [0, 1.56, -3.5]);
	box(wall, [3, 3, 0.15], [0, 1.56, 3.5]);

	// Four wall sections leave a 2.9 m × 1.2 m opening on the corridor side.
	box(wall, [0.16, 1.17, 7], [1.5, 0.665, 0]);
	box(wall, [0.16, 0.6, 7], [1.5, 2.75, 0]);
	for (const side of [-1, 1]) {
		box(wall, [0.16, 1.2, 2.05], [1.5, 1.85, side * 2.475]);
		box(trim, [0.1, 1.28, 0.09], [1.39, 1.85, side * 1.45]);
	}
	box(trim, [0.32, 0.09, 3], [1.38, 1.23, 0]);
	box(trim, [0.13, 0.09, 3], [1.39, 2.47, 0]);
	box(lamp, [0.08, 0.12, 1.25], [1.37, 2.73, 0]);

	box(trim, [0.65, 0.34, 1.8], [0.94, 0.25, 0]);
	box(bench, [0.68, 0.15, 1.85], [0.94, 0.49, 0]);

	const ground = new Mesh(
		new PlaneGeometry(160, 160),
		new MeshStandardMaterial({ color: 0x647a91 }),
	);
	ground.rotation.x = -Math.PI / 2;
	ground.position.y = -0.5;
	scene.add(ground);

	const cone = new ConeGeometry(1, 4, 7);
	const trees = new MeshStandardMaterial({
		color: 0x2b465a,
		flatShading: true,
	});
	const treeSites = [
		[7, -3, 1.05],
		[9, -8, 1.25],
		[11, -6, 0.8],
		[15, -12, 1.4],
		[17, -7, 1.15],
		[19, -16, 1.55],
		[23, -11, 1.35],
	] as const;
	for (const [x, z, scale] of treeSites) {
		const tree = new Mesh(cone, trees);
		tree.scale.setScalar(scale);
		tree.position.set(x, 2 * scale - 0.5, z);
		scene.add(tree);
	}

	const light = new DirectionalLight(0xaaccff, 2.3);
	light.position.set(7, 8, 5);
	scene.add(new HemisphereLight(0xa1b8e2, 0xc18a60, 2.1), light);
	return { scene, camera };
}
