import {
	BoxGeometry,
	CapsuleGeometry,
	Group,
	Mesh,
	MeshStandardMaterial,
} from "three";

export const avatarRadius = 0.22;
const height = 1.7;

export function createAvatar() {
	const group = new Group();
	const coat = new MeshStandardMaterial({ color: 0x35505d, alphaHash: true });
	const accent = new MeshStandardMaterial({ color: 0xbc8d6c, alphaHash: true });
	const body = new Mesh(
		new CapsuleGeometry(avatarRadius, height - 2 * avatarRadius, 6, 12),
		coat,
	);
	body.position.y = height / 2;
	const nose = new Mesh(new BoxGeometry(0.1, 0.085, 0.11), accent);
	nose.position.set(0, 1.52, -0.205);
	group.add(body, nose);

	return {
		group,
		render(
			pose: { x: number; z: number; yaw: number },
			camera: { x: number; y: number; z: number },
		) {
			group.position.set(pose.x, 0, pose.z);
			group.rotation.y = pose.yaw;
			const cameraDistance = Math.hypot(
				camera.x - pose.x,
				camera.z - pose.z,
				Math.max(
					0,
					camera.y - (height - avatarRadius),
					avatarRadius - camera.y,
				),
			);
			const opacity = Math.max(
				0,
				Math.min(1, (cameraDistance - 0.27) / (0.6 - 0.27)),
			);
			coat.opacity = accent.opacity = opacity;
			group.visible = opacity > 0;
		},
	};
}
