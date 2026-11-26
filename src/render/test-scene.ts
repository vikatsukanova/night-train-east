import { Scene } from "three";

// The carriage lives in src/train/ and the exterior and its lighting in src/world/.
// This stays as the scene root until a Game composition module replaces it.
export function createTestScene() {
	return { scene: new Scene() };
}
