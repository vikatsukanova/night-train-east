import {
	Color,
	Euler,
	Group,
	InstancedMesh,
	Matrix4,
	Mesh,
	MeshStandardMaterial,
	Quaternion,
	Vector3,
} from "three";
import {
	BALLAST_TOP_Y,
	BIRCH_STRIDE,
	createChunkPlacementBuffer,
	fillChunkPlacements,
	MAX_BIRCHES_PER_CHUNK,
	MAX_SPRUCES_PER_CHUNK,
	POLE_STRIDE,
	POLES_PER_CHUNK,
	SLEEPERS_PER_CHUNK,
	SPRUCE_STRIDE,
} from "./birchLayout";
import {
	activeChunkIndices,
	CHUNK_LENGTH_M,
	chunkIndexAtDistance,
	chunkMinViewDepth,
	chunkRingSlot,
	chunkStartDistanceM,
	chunkWorldZ,
	isChunkVisibleInFog,
	RING_SIZE,
	type ViewRay,
} from "./chunkMath";
import {
	createBirchBarkTexture,
	createBirchGeometry,
	createRailsGeometry,
	createSleeperGeometry,
	createSpruceGeometry,
	createTelegraphPoleGeometry,
	createTerrainChunkGeometry,
	NOMINAL_BIRCH_HEIGHT_M,
	NOMINAL_BIRCH_RADIUS_M,
} from "./geometries";

const REBASE_DISTANCE_M = 1_600;
const EXTERIOR_RENDER_ORDER = 5;

const ZERO_MATRIX = new Matrix4().makeScale(0, 0, 0);

export interface ChunkManagerOptions {
	readonly routeSeed: number;
	readonly fogCutoffM: number;
}

export class TreadmillChunkManager {
	readonly root = new Group();
	private readonly instancedGroup = new Group();
	private readonly routeSeed: number;
	private fogCutoffM: number;

	// Pooled terrain meshes sharing one BufferGeometry and one Material.
	private readonly terrainMeshes: Mesh[] = [];
	private readonly railMesh: Mesh;

	// One InstancedMesh per archetype across the entire active ring buffer.
	private readonly birchMesh: InstancedMesh;
	private readonly spruceMesh: InstancedMesh;
	private readonly poleMesh: InstancedMesh;
	private readonly sleeperMesh: InstancedMesh;

	// Disposables owned by this manager.
	private readonly disposeCallbacks: (() => void)[] = [];

	// Ring-slot tracking (zero runtime allocations).
	private readonly slotChunkIndex = new Float64Array(RING_SIZE).fill(
		Number.NaN,
	);
	private readonly slotSubmitted = new Uint8Array(RING_SIZE);
	private readonly activeChunksScratch = new Array<number>(RING_SIZE).fill(0);
	private readonly placementScratch = createChunkPlacementBuffer();

	// Pre-allocated math temporaries so recycling allocates zero heap objects.
	private readonly tmpMatrix = new Matrix4();
	private readonly tmpPos = new Vector3();
	private readonly tmpQuat = new Quaternion();
	private readonly tmpEuler = new Euler(0, 0, 0, "YXZ");
	private readonly tmpScale = new Vector3();
	private readonly tmpColor = new Color();

	private anchorM = 0;
	private initialized = false;
	private visibleChunks = 0;

	constructor(options: ChunkManagerOptions) {
		this.routeSeed = options.routeSeed | 0;
		this.fogCutoffM = options.fogCutoffM;

		this.root.name = "treadmill-world";
		this.instancedGroup.name = "treadmill-instanced";
		this.root.add(this.instancedGroup);

		// Shared snowy terrain + ballast embankment geometry across all 10 pooled chunks.
		const terrainGeom = createTerrainChunkGeometry();
		const terrainMat = new MeshStandardMaterial({
			vertexColors: true,
			roughness: 0.92,
			metalness: 0.0,
		});
		for (let slot = 0; slot < RING_SIZE; slot++) {
			const mesh = new Mesh(terrainGeom, terrainMat);
			mesh.renderOrder = EXTERIOR_RENDER_ORDER;
			mesh.frustumCulled = false;
			mesh.visible = false;
			this.terrainMeshes.push(mesh);
			this.root.add(mesh);
		}

		// Continuous twin steel rails directly under the train (1 draw call).
		const railsGeom = createRailsGeometry();
		const railsMat = new MeshStandardMaterial({
			color: 0x526176,
			roughness: 0.36,
			metalness: 0.82,
		});
		this.railMesh = new Mesh(railsGeom, railsMat);
		this.railMesh.renderOrder = EXTERIOR_RENDER_ORDER;
		this.railMesh.frustumCulled = false;
		this.root.add(this.railMesh);

		// Birch trees (1 InstancedMesh across all chunks).
		const barkTexture = createBirchBarkTexture();
		const birchGeom = createBirchGeometry();
		const birchMat = new MeshStandardMaterial({
			map: barkTexture,
			vertexColors: true,
			roughness: 0.86,
			metalness: 0.0,
		});
		this.birchMesh = new InstancedMesh(
			birchGeom,
			birchMat,
			RING_SIZE * MAX_BIRCHES_PER_CHUNK,
		);
		this.birchMesh.renderOrder = EXTERIOR_RENDER_ORDER;
		this.birchMesh.frustumCulled = false;
		this.initInstanceSlots(this.birchMesh, true);
		this.instancedGroup.add(this.birchMesh);

		// Dark spruce trees (1 InstancedMesh across all chunks).
		const spruceGeom = createSpruceGeometry();
		const spruceMat = new MeshStandardMaterial({
			vertexColors: true,
			flatShading: true,
			roughness: 0.94,
			metalness: 0.0,
		});
		this.spruceMesh = new InstancedMesh(
			spruceGeom,
			spruceMat,
			RING_SIZE * MAX_SPRUCES_PER_CHUNK,
		);
		this.spruceMesh.renderOrder = EXTERIOR_RENDER_ORDER;
		this.spruceMesh.frustumCulled = false;
		this.initInstanceSlots(this.spruceMesh, true);
		this.instancedGroup.add(this.spruceMesh);

		// Trackside telegraph poles + catenary wires (1 InstancedMesh across all chunks).
		const poleGeom = createTelegraphPoleGeometry();
		const poleMat = new MeshStandardMaterial({
			vertexColors: true,
			roughness: 0.88,
			metalness: 0.06,
		});
		this.poleMesh = new InstancedMesh(
			poleGeom,
			poleMat,
			RING_SIZE * POLES_PER_CHUNK,
		);
		this.poleMesh.renderOrder = EXTERIOR_RENDER_ORDER;
		this.poleMesh.frustumCulled = false;
		this.initInstanceSlots(this.poleMesh, false);
		this.instancedGroup.add(this.poleMesh);

		// Wooden railway sleepers (1 InstancedMesh across all chunks).
		const sleeperGeom = createSleeperGeometry();
		const sleeperMat = new MeshStandardMaterial({
			color: 0x3b312c,
			roughness: 0.95,
			metalness: 0.0,
		});
		this.sleeperMesh = new InstancedMesh(
			sleeperGeom,
			sleeperMat,
			RING_SIZE * SLEEPERS_PER_CHUNK,
		);
		this.sleeperMesh.renderOrder = EXTERIOR_RENDER_ORDER;
		this.sleeperMesh.frustumCulled = false;
		this.initInstanceSlots(this.sleeperMesh, false);
		this.instancedGroup.add(this.sleeperMesh);

		this.disposeCallbacks.push(() => {
			terrainGeom.dispose();
			terrainMat.dispose();
			railsGeom.dispose();
			railsMat.dispose();
			barkTexture.dispose();
			birchGeom.dispose();
			birchMat.dispose();
			spruceGeom.dispose();
			spruceMat.dispose();
			poleGeom.dispose();
			poleMat.dispose();
			sleeperGeom.dispose();
			sleeperMat.dispose();
			this.birchMesh.dispose();
			this.spruceMesh.dispose();
			this.poleMesh.dispose();
			this.sleeperMesh.dispose();
		});
	}

	private initInstanceSlots(mesh: InstancedMesh, withColor: boolean): void {
		const white = this.tmpColor.setRGB(1, 1, 1);
		for (let i = 0; i < mesh.count; i++) {
			mesh.setMatrixAt(i, ZERO_MATRIX);
			if (withColor) mesh.setColorAt(i, white);
		}
		mesh.instanceMatrix.needsUpdate = true;
		if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
	}

	/**
	 * @param fogCutoffM view depth at which fog reaches ~98% opacity.
	 * @param trackCapM quality-tier cap on distance along the track (independent of fog).
	 * @param view camera position + forward; without it the fog cut falls back to track distance.
	 */
	update(
		distanceM: number,
		fogCutoffM?: number,
		trackCapM: number = Number.POSITIVE_INFINITY,
		view?: ViewRay,
	): void {
		if (fogCutoffM !== undefined && Number.isFinite(fogCutoffM)) {
			this.fogCutoffM = fogCutoffM;
		}
		const needsRebase =
			!this.initialized ||
			Math.abs(distanceM - this.anchorM) >= REBASE_DISTANCE_M;
		if (needsRebase) {
			this.anchorM = chunkStartDistanceM(chunkIndexAtDistance(distanceM));
			this.initialized = true;
		}

		// Cheap per-frame treadmill offset for all instanced scenery.
		this.instancedGroup.position.z = distanceM - this.anchorM;

		const chunks = activeChunkIndices(distanceM, this.activeChunksScratch);
		let visibleCount = 0;

		for (let i = 0; i < RING_SIZE; i++) {
			const chunkIndex = chunks[i] ?? 0;
			const slot = chunkRingSlot(chunkIndex);
			const withinTrackCap = isChunkVisibleInFog(
				chunkIndex,
				distanceM,
				trackCapM,
			);
			const withinFog = view
				? chunkMinViewDepth(chunkIndex, distanceM, view) <= this.fogCutoffM
				: isChunkVisibleInFog(chunkIndex, distanceM, this.fogCutoffM);
			const visible = withinTrackCap && withinFog;

			const terrain = this.terrainMeshes[slot];
			if (terrain) {
				terrain.visible = visible;
				if (visible) {
					terrain.position.z = chunkWorldZ(chunkIndex, distanceM);
				}
			}

			if (visible) {
				visibleCount++;
				if (
					needsRebase ||
					this.slotChunkIndex[slot] !== chunkIndex ||
					this.slotSubmitted[slot] === 0
				) {
					this.populateSlot(slot, chunkIndex);
					this.slotChunkIndex[slot] = chunkIndex;
					this.slotSubmitted[slot] = 1;
				}
			} else if (
				this.slotSubmitted[slot] === 1 ||
				this.slotChunkIndex[slot] !== chunkIndex
			) {
				this.clearSlot(slot);
				this.slotChunkIndex[slot] = chunkIndex;
				this.slotSubmitted[slot] = 0;
			}
		}

		this.visibleChunks = visibleCount;
	}

	private clearSlot(slot: number): void {
		this.zeroSlice(
			this.birchMesh,
			slot * MAX_BIRCHES_PER_CHUNK,
			MAX_BIRCHES_PER_CHUNK,
		);
		this.zeroSlice(
			this.spruceMesh,
			slot * MAX_SPRUCES_PER_CHUNK,
			MAX_SPRUCES_PER_CHUNK,
		);
		this.zeroSlice(this.poleMesh, slot * POLES_PER_CHUNK, POLES_PER_CHUNK);
		this.zeroSlice(
			this.sleeperMesh,
			slot * SLEEPERS_PER_CHUNK,
			SLEEPERS_PER_CHUNK,
		);
	}

	private zeroSlice(mesh: InstancedMesh, start: number, count: number): void {
		for (let i = 0; i < count; i++) {
			mesh.setMatrixAt(start + i, ZERO_MATRIX);
		}
		mesh.instanceMatrix.addUpdateRange(start * 16, count * 16);
		mesh.instanceMatrix.needsUpdate = true;
	}

	private populateSlot(slot: number, chunkIndex: number): void {
		const layout = this.placementScratch;
		fillChunkPlacements(this.routeSeed, chunkIndex, layout);

		// Chunk origin in instancedGroup local Z so worldZ = (distanceM - anchorM) + localZ = distanceM - (chunkStart + u).
		const chunkOriginLocalZ = this.anchorM - chunkStartDistanceM(chunkIndex);

		// 1. Birches
		const birchStart = slot * MAX_BIRCHES_PER_CHUNK;
		const birches = layout.birches;
		for (let i = 0; i < layout.birchCount; i++) {
			const base = i * BIRCH_STRIDE;
			const x = birches[base] ?? 0;
			const u = birches[base + 1] ?? 0;
			const y = birches[base + 2] ?? 0;
			const height = birches[base + 3] ?? 12;
			const radius = birches[base + 4] ?? 0.14;
			const leanX = birches[base + 5] ?? 0;
			const leanZ = birches[base + 6] ?? 0;
			const yaw = birches[base + 7] ?? 0;
			const tint = birches[base + 8] ?? 1;

			this.tmpPos.set(x, y, chunkOriginLocalZ - u);
			this.tmpEuler.set(leanX, yaw, leanZ, "YXZ");
			this.tmpQuat.setFromEuler(this.tmpEuler);
			const radiusScale = radius / NOMINAL_BIRCH_RADIUS_M;
			const heightScale = height / NOMINAL_BIRCH_HEIGHT_M;
			this.tmpScale.set(radiusScale, heightScale, radiusScale);
			this.tmpMatrix.compose(this.tmpPos, this.tmpQuat, this.tmpScale);
			this.birchMesh.setMatrixAt(birchStart + i, this.tmpMatrix);

			// Crisp cool-white moonlight variation per birch trunk.
			this.tmpColor.setRGB(
				Math.min(1.12, tint * 1.02),
				Math.min(1.14, tint * 1.04),
				Math.min(1.18, tint * 1.08),
			);
			this.birchMesh.setColorAt(birchStart + i, this.tmpColor);
		}
		for (let i = layout.birchCount; i < MAX_BIRCHES_PER_CHUNK; i++) {
			this.birchMesh.setMatrixAt(birchStart + i, ZERO_MATRIX);
		}
		this.birchMesh.instanceMatrix.addUpdateRange(
			birchStart * 16,
			MAX_BIRCHES_PER_CHUNK * 16,
		);
		this.birchMesh.instanceMatrix.needsUpdate = true;
		if (this.birchMesh.instanceColor) {
			this.birchMesh.instanceColor.addUpdateRange(
				birchStart * 3,
				MAX_BIRCHES_PER_CHUNK * 3,
			);
			this.birchMesh.instanceColor.needsUpdate = true;
		}

		// 2. Spruces
		const spruceStart = slot * MAX_SPRUCES_PER_CHUNK;
		const spruces = layout.spruces;
		for (let i = 0; i < layout.spruceCount; i++) {
			const base = i * SPRUCE_STRIDE;
			const x = spruces[base] ?? 0;
			const u = spruces[base + 1] ?? 0;
			const y = spruces[base + 2] ?? 0;
			const height = spruces[base + 3] ?? 12;
			const radius = spruces[base + 4] ?? 2;
			const yaw = spruces[base + 5] ?? 0;
			const tint = spruces[base + 6] ?? 1;

			this.tmpPos.set(x, y, chunkOriginLocalZ - u);
			this.tmpEuler.set(0, yaw, 0, "YXZ");
			this.tmpQuat.setFromEuler(this.tmpEuler);
			this.tmpScale.set(radius, height, radius);
			this.tmpMatrix.compose(this.tmpPos, this.tmpQuat, this.tmpScale);
			this.spruceMesh.setMatrixAt(spruceStart + i, this.tmpMatrix);

			this.tmpColor.setRGB(tint * 0.85, tint * 0.95, tint * 1.05);
			this.spruceMesh.setColorAt(spruceStart + i, this.tmpColor);
		}
		for (let i = layout.spruceCount; i < MAX_SPRUCES_PER_CHUNK; i++) {
			this.spruceMesh.setMatrixAt(spruceStart + i, ZERO_MATRIX);
		}
		this.spruceMesh.instanceMatrix.addUpdateRange(
			spruceStart * 16,
			MAX_SPRUCES_PER_CHUNK * 16,
		);
		this.spruceMesh.instanceMatrix.needsUpdate = true;
		if (this.spruceMesh.instanceColor) {
			this.spruceMesh.instanceColor.addUpdateRange(
				spruceStart * 3,
				MAX_SPRUCES_PER_CHUNK * 3,
			);
			this.spruceMesh.instanceColor.needsUpdate = true;
		}

		// 3. Telegraph poles
		const poleStart = slot * POLES_PER_CHUNK;
		const poles = layout.poles;
		this.tmpQuat.identity();
		this.tmpScale.set(1, 1, 1);
		for (let i = 0; i < layout.poleCount; i++) {
			const base = i * POLE_STRIDE;
			const x = poles[base] ?? 0;
			const u = poles[base + 1] ?? 0;
			const y = poles[base + 2] ?? 0;
			this.tmpPos.set(x, y, chunkOriginLocalZ - u);
			this.tmpMatrix.compose(this.tmpPos, this.tmpQuat, this.tmpScale);
			this.poleMesh.setMatrixAt(poleStart + i, this.tmpMatrix);
		}
		this.poleMesh.instanceMatrix.addUpdateRange(
			poleStart * 16,
			POLES_PER_CHUNK * 16,
		);
		this.poleMesh.instanceMatrix.needsUpdate = true;

		// 4. Railway sleepers
		const sleeperStart = slot * SLEEPERS_PER_CHUNK;
		const sleeperStep = CHUNK_LENGTH_M / SLEEPERS_PER_CHUNK;
		const sleeperY = BALLAST_TOP_Y + 0.02;
		for (let i = 0; i < SLEEPERS_PER_CHUNK; i++) {
			const u = (i + 0.5) * sleeperStep;
			this.tmpPos.set(0, sleeperY, chunkOriginLocalZ - u);
			this.tmpMatrix.compose(this.tmpPos, this.tmpQuat, this.tmpScale);
			this.sleeperMesh.setMatrixAt(sleeperStart + i, this.tmpMatrix);
		}
		this.sleeperMesh.instanceMatrix.addUpdateRange(
			sleeperStart * 16,
			SLEEPERS_PER_CHUNK * 16,
		);
		this.sleeperMesh.instanceMatrix.needsUpdate = true;
	}

	getActiveChunkIndices(): readonly number[] {
		return this.activeChunksScratch;
	}

	getVisibleChunkCount(): number {
		return this.visibleChunks;
	}

	getChunkPoolSize(): number {
		return RING_SIZE;
	}

	dispose(): void {
		this.root.removeFromParent();
		for (const cleanup of this.disposeCallbacks) cleanup();
		this.disposeCallbacks.length = 0;
	}
}
