import {
	Color,
	ConeGeometry,
	DirectionalLight,
	FogExp2,
	HemisphereLight,
	Mesh,
	MeshStandardMaterial,
	PlaneGeometry,
	Scene,
} from "three";

export function createTestScene() {
	const scene = new Scene();
	const night = new Color(0x14243f);
	scene.background = night;
	scene.fog = new FogExp2(night, 0.033);

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
	return { scene };
}
