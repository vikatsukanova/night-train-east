import {
	BoxGeometry,
	BufferAttribute,
	BufferGeometry,
	Color,
	ConeGeometry,
	CylinderGeometry,
	DataTexture,
	LinearFilter,
	LinearMipmapLinearFilter,
	RepeatWrapping,
	RGBAFormat,
	SRGBColorSpace,
	UnsignedByteType,
	Vector3,
} from "three";
import { mulberry32 } from "../../core/rng";
import {
	BALLAST_HALF_WIDTH,
	EMBANKMENT_FOOT_X,
	TELEGRAPH_POLE_SPACING_M,
	terrainHeightAt,
} from "./birchLayout";
import { CHUNK_LENGTH_M } from "./chunkMath";

/** Merges multiple non-indexed or indexed BufferGeometries that share position, normal, uv, and optional color attributes. */
function mergeGeometries(parts: readonly BufferGeometry[]): BufferGeometry {
	const normalized = parts.map((part) => {
		const geom = part.index ? part.toNonIndexed() : part.clone();
		if (!geom.getAttribute("normal")) geom.computeVertexNormals();
		const count = geom.getAttribute("position").count;
		if (!geom.getAttribute("uv")) {
			geom.setAttribute(
				"uv",
				new BufferAttribute(new Float32Array(count * 2), 2),
			);
		}
		if (!geom.getAttribute("color")) {
			const white = new Float32Array(count * 3);
			white.fill(1);
			geom.setAttribute("color", new BufferAttribute(white, 3));
		}
		return geom;
	});

	let totalVerts = 0;
	for (const g of normalized) {
		totalVerts += g.getAttribute("position").count;
	}

	const positions = new Float32Array(totalVerts * 3);
	const normals = new Float32Array(totalVerts * 3);
	const uvs = new Float32Array(totalVerts * 2);
	const colors = new Float32Array(totalVerts * 3);

	let offset = 0;
	for (const g of normalized) {
		const pos = g.getAttribute("position");
		const norm = g.getAttribute("normal");
		const uv = g.getAttribute("uv");
		const col = g.getAttribute("color");
		const count = pos.count;

		positions.set(pos.array as Float32Array, offset * 3);
		normals.set(norm.array as Float32Array, offset * 3);
		uvs.set(uv.array as Float32Array, offset * 2);
		colors.set(col.array as Float32Array, offset * 3);
		offset += count;
		g.dispose();
	}

	const merged = new BufferGeometry();
	merged.setAttribute("position", new BufferAttribute(positions, 3));
	merged.setAttribute("normal", new BufferAttribute(normals, 3));
	merged.setAttribute("uv", new BufferAttribute(uvs, 2));
	merged.setAttribute("color", new BufferAttribute(colors, 3));
	return merged;
}

function paintGeometryColor(geom: BufferGeometry, hex: number): BufferGeometry {
	const count = geom.getAttribute("position").count;
	const color = new Color(hex);
	const arr = new Float32Array(count * 3);
	for (let i = 0; i < count; i++) {
		arr[i * 3] = color.r;
		arr[i * 3 + 1] = color.g;
		arr[i * 3 + 2] = color.b;
	}
	geom.setAttribute("color", new BufferAttribute(arr, 3));
	return geom;
}

export const NOMINAL_BIRCH_HEIGHT_M = 13;
export const NOMINAL_BIRCH_RADIUS_M = 0.15;

/**
 * Deterministic 64x512 procedural birch bark texture:
 * bright creamy-silver bark with crisp dark horizontal lenticel bands and a rugged dark base.
 */
export function createBirchBarkTexture(): DataTexture {
	const width = 64;
	const height = 512;
	const data = new Uint8Array(width * height * 4);
	const rand = mulberry32(0xb12c4_01);

	// Bright pale silver-white birch bark with subtle horizontal paper-grain noise.
	for (let y = 0; y < height; y++) {
		const v = y / (height - 1);
		const rowShade = 0.94 + rand() * 0.06;
		// Darken the rugged lower trunk base smoothly up to ~1.3 m.
		const baseDark = v < 0.09 ? 0.2 + (v / 0.09) * 0.8 : 1.0;

		for (let x = 0; x < width; x++) {
			const grain = (0.95 + rand() * 0.05) * rowShade * baseDark;
			const r = Math.min(255, Math.round(244 * grain));
			const g = Math.min(255, Math.round(247 * grain));
			const b = Math.min(255, Math.round(252 * grain));
			const idx = (y * width + x) * 4;
			data[idx] = r;
			data[idx + 1] = g;
			data[idx + 2] = b;
			data[idx + 3] = 255;
		}
	}

	// Crisp horizontal dark birch bark lenticel bands and knot marks (matching M1 birch trunks).
	const bandCount = 135;
	for (let i = 0; i < bandCount; i++) {
		const cy = Math.floor((0.06 + rand() * 0.9) * height);
		const cx = Math.floor(rand() * width);
		const isKnot = rand() < 0.24;
		const halfW = isKnot
			? 6 + Math.floor(rand() * 14)
			: 4 + Math.floor(rand() * 11);
		const halfH = isKnot
			? 3 + Math.floor(rand() * 3)
			: 1 + Math.floor(rand() * 2);

		for (let dy = -halfH; dy <= halfH; dy++) {
			const py = cy + dy;
			if (py < 0 || py >= height) continue;
			const vFalloff = 1 - Math.abs(dy) / (halfH + 0.7);
			for (let dx = -halfW; dx <= halfW; dx++) {
				const px = (cx + dx + width) % width;
				const hFalloff = 1 - Math.abs(dx) / (halfW + 0.8);
				const blend = Math.min(1, hFalloff * vFalloff * 1.8);
				const idx = (py * width + px) * 4;
				data[idx] = Math.round((data[idx] ?? 240) * (1 - blend) + 18 * blend);
				data[idx + 1] = Math.round(
					(data[idx + 1] ?? 244) * (1 - blend) + 23 * blend,
				);
				data[idx + 2] = Math.round(
					(data[idx + 2] ?? 250) * (1 - blend) + 34 * blend,
				);
			}
		}
	}

	// Rugged dark bark crevices at the bottom root flare.
	for (let i = 0; i < 24; i++) {
		const cy = Math.floor(rand() * height * 0.1);
		const cx = Math.floor(rand() * width);
		const halfW = 2 + Math.floor(rand() * 6);
		const halfH = 4 + Math.floor(rand() * 10);
		for (let dy = -halfH; dy <= halfH; dy++) {
			const py = cy + dy;
			if (py < 0 || py >= height) continue;
			for (let dx = -halfW; dx <= halfW; dx++) {
				const px = (cx + dx + width) % width;
				const idx = (py * width + px) * 4;
				data[idx] = 24;
				data[idx + 1] = 29;
				data[idx + 2] = 40;
			}
		}
	}

	const texture = new DataTexture(
		data,
		width,
		height,
		RGBAFormat,
		UnsignedByteType,
	);
	texture.colorSpace = SRGBColorSpace;
	texture.wrapS = RepeatWrapping;
	texture.wrapT = RepeatWrapping;
	texture.magFilter = LinearFilter;
	texture.minFilter = LinearMipmapLinearFilter;
	texture.generateMipmaps = true;
	texture.needsUpdate = true;
	return texture;
}

/**
 * Real-world-scale birch geometry (nominal 13 m tall, 0.15 m base radius) so
 * nearly uniform per-instance scaling keeps trunk bark UVs and delicate winter twigs undistorted.
 */
export function createBirchGeometry(): BufferGeometry {
	const parts: BufferGeometry[] = [];
	const h = NOMINAL_BIRCH_HEIGHT_M;
	const rBase = NOMINAL_BIRCH_RADIUS_M;

	// Main tapered trunk (7 sides x 5 rings -> 70 tris).
	const trunk = new CylinderGeometry(rBase * 0.25, rBase, h, 7, 5, false);
	trunk.translate(0, h * 0.5, 0);

	// Subtle natural bow + gentle base/top shading.
	const pos = trunk.getAttribute("position");
	const colors = new Float32Array(pos.count * 3);
	for (let i = 0; i < pos.count; i++) {
		const y = pos.getY(i);
		const t = y / h;
		const bow = Math.sin(t * Math.PI) * 0.09;
		pos.setX(i, pos.getX(i) + bow);

		const shade = t < 0.07 ? 0.65 + (t / 0.07) * 0.35 : 1.0 - t * 0.12;
		colors[i * 3] = shade;
		colors[i * 3 + 1] = shade;
		colors[i * 3 + 2] = Math.min(1, shade * 1.02);
	}
	trunk.setAttribute("color", new BufferAttribute(colors, 3));
	trunk.computeVertexNormals();
	parts.push(trunk);

	// Delicate bare winter upper twigs (4 slim branches in real metres -> 32 tris).
	const branchSpecs = [
		{ y: h * 0.42, angle: 0.6, reach: 1.05, rise: 1.45, r: 0.022 },
		{ y: h * 0.55, angle: 2.6, reach: 1.15, rise: 1.6, r: 0.02 },
		{ y: h * 0.68, angle: 4.3, reach: 0.95, rise: 1.35, r: 0.017 },
		{ y: h * 0.8, angle: 1.5, reach: 0.72, rise: 1.05, r: 0.014 },
	] as const;

	for (const spec of branchSpecs) {
		const dx = Math.cos(spec.angle) * spec.reach;
		const dz = Math.sin(spec.angle) * spec.reach;
		const dy = spec.rise;
		const len = Math.hypot(dx, dy, dz);
		const branch = new CylinderGeometry(spec.r * 0.3, spec.r, len, 4, 1, false);
		branch.translate(0, len * 0.5, 0);

		const dir = new Vector3(dx, dy, dz).normalize();
		const pitch = Math.acos(dir.y);
		const yaw = Math.atan2(dir.x, dir.z);
		branch.rotateX(pitch);
		branch.rotateY(yaw);
		const t = spec.y / h;
		branch.translate(Math.sin(t * Math.PI) * 0.09, spec.y, 0);

		paintGeometryColor(branch, 0x3b485c);
		parts.push(branch);
	}

	const merged = mergeGeometries(parts);
	for (const part of parts) part.dispose();
	return merged;
}

/**
 * Unit dark spruce geometry (height = 1.0, radius = 1.0) with 3 tiered cones + short trunk.
 */
export function createSpruceGeometry(): BufferGeometry {
	const parts: BufferGeometry[] = [];

	const trunk = new CylinderGeometry(0.08, 0.12, 0.22, 5, 1);
	trunk.translate(0, 0.11, 0);
	paintGeometryColor(trunk, 0x1e1b1d);
	parts.push(trunk);

	const tiers = [
		{ y: 0.38, h: 0.48, r: 1.0, hex: 0x162b3c },
		{ y: 0.63, h: 0.42, r: 0.76, hex: 0x1c364a },
		{ y: 0.84, h: 0.34, r: 0.48, hex: 0x244259 },
	] as const;

	for (const tier of tiers) {
		const cone = new ConeGeometry(tier.r, tier.h, 6, 1);
		cone.translate(0, tier.y, 0);
		paintGeometryColor(cone, tier.hex);
		parts.push(cone);
	}

	const merged = mergeGeometries(parts);
	for (const part of parts) part.dispose();
	return merged;
}

/**
 * Trackside telegraph pole with crossarm, ceramic insulators, and a 40 m sagging
 * dual-wire span extending along -Z to the next pole (zero seams, 1 draw call total).
 */
export function createTelegraphPoleGeometry(): BufferGeometry {
	const parts: BufferGeometry[] = [];

	// Main weathered wooden pole (base y = 0, top y = 4.9 m -> rises cleanly across window view).
	const poleHeight = 4.9;
	const pole = new CylinderGeometry(0.072, 0.115, poleHeight, 7, 1);
	pole.translate(0, poleHeight * 0.5, 0);
	paintGeometryColor(pole, 0x3b3533);
	parts.push(pole);

	// Horizontal wooden crossarm perpendicular to track (along X).
	const crossarmY = 4.48;
	const crossarm = new BoxGeometry(1.48, 0.1, 0.1);
	crossarm.translate(0, crossarmY, 0);
	paintGeometryColor(crossarm, 0x35302e);
	parts.push(crossarm);

	// Four small porcelain insulators along the crossarm.
	const insulatorXs = [-0.6, -0.24, 0.24, 0.6];
	for (const ix of insulatorXs) {
		const insulator = new CylinderGeometry(0.032, 0.04, 0.11, 6, 1);
		insulator.translate(ix, crossarmY + 0.09, 0);
		paintGeometryColor(insulator, 0x9bb2cc);
		parts.push(insulator);
	}

	// Two sagging catenary wires spanning 40 m to the next pole along -Z.
	const spanM = TELEGRAPH_POLE_SPACING_M;
	const segments = 8;
	const wireY = crossarmY + 0.11;
	const wireSag = 0.54;
	const wireXs = [-0.6, 0.6];

	for (const wx of wireXs) {
		for (let s = 0; s < segments; s++) {
			const t0 = s / segments;
			const t1 = (s + 1) / segments;
			const z0 = -t0 * spanM;
			const z1 = -t1 * spanM;
			const y0 = wireY - 4 * wireSag * t0 * (1 - t0);
			const y1 = wireY - 4 * wireSag * t1 * (1 - t1);

			const dz = z1 - z0;
			const dy = y1 - y0;
			const segLen = Math.hypot(dy, dz);
			const wire = new BoxGeometry(0.016, 0.016, segLen);
			const pitch = Math.atan2(dy, -dz);
			wire.rotateX(pitch);
			wire.translate(wx, (y0 + y1) * 0.5, (z0 + z1) * 0.5);
			paintGeometryColor(wire, 0x1a2638);
			parts.push(wire);
		}
	}

	const merged = mergeGeometries(parts);
	for (const part of parts) part.dispose();
	return merged;
}

/**
 * Shared 80 m terrain chunk BufferGeometry covering ballast bed, embankment slopes,
 * and undulating moonlit snowfields out to +/-175 m. Exact seam match at localZ = 0 and -80.
 */
export function createTerrainChunkGeometry(): BufferGeometry {
	// Symmetric non-uniform X stops: dense near track & embankment, wider far out.
	const halfStops = [
		0, 1.0, 1.8, 2.7, 3.9, 5.4, 8.0, 12.0, 18.0, 26.0, 38.0, 56.0, 82.0, 120.0,
		175.0,
	];
	const xs: number[] = [];
	for (let i = halfStops.length - 1; i > 0; i--) {
		xs.push(-(halfStops[i] ?? 0));
	}
	for (const x of halfStops) {
		xs.push(x);
	}

	const zSteps = 16;
	const cols = xs.length;
	const rows = zSteps + 1;

	const positions = new Float32Array(cols * rows * 3);
	const colors = new Float32Array(cols * rows * 3);
	const indices: number[] = [];

	const ballastCol = new Color(0x283344);
	const shoulderCol = new Color(0x7895b8);
	const snowLowCol = new Color(0x7291b8);
	const snowHighCol = new Color(0xd0e2f5);
	const tmpCol = new Color();

	for (let r = 0; r < rows; r++) {
		const u = (r / zSteps) * CHUNK_LENGTH_M;
		const localZ = -u;

		for (let c = 0; c < cols; c++) {
			const x = xs[c] ?? 0;
			const y = terrainHeightAt(x, u);
			const vIdx = r * cols + c;

			positions[vIdx * 3] = x;
			positions[vIdx * 3 + 1] = y;
			positions[vIdx * 3 + 2] = localZ;

			const absX = Math.abs(x);
			if (absX <= BALLAST_HALF_WIDTH) {
				tmpCol.copy(ballastCol);
			} else if (absX < EMBANKMENT_FOOT_X) {
				const t =
					(absX - BALLAST_HALF_WIDTH) /
					(EMBANKMENT_FOOT_X - BALLAST_HALF_WIDTH);
				tmpCol.copy(ballastCol).lerp(shoulderCol, t * t * (3 - 2 * t));
			} else {
				// Subtle moonlit crest/trough tinting across snowdrifts.
				const crest = Math.max(0, Math.min(1, (y + 1.85) / 2.2));
				tmpCol.copy(snowLowCol).lerp(snowHighCol, 0.35 + crest * 0.65);
			}

			colors[vIdx * 3] = tmpCol.r;
			colors[vIdx * 3 + 1] = tmpCol.g;
			colors[vIdx * 3 + 2] = tmpCol.b;
		}
	}

	for (let r = 0; r < zSteps; r++) {
		for (let c = 0; c < cols - 1; c++) {
			const a = r * cols + c;
			const b = a + 1;
			const d = (r + 1) * cols + c;
			const e = d + 1;
			// Outward +Y winding: (a, b, d) and (b, e, d) since localZ decreases with r.
			indices.push(a, b, d, b, e, d);
		}
	}

	const geom = new BufferGeometry();
	geom.setAttribute("position", new BufferAttribute(positions, 3));
	geom.setAttribute("color", new BufferAttribute(colors, 3));
	geom.setIndex(indices);
	geom.computeVertexNormals();
	return geom;
}

/** Single merged twin-rail geometry (1520 mm Russian broad gauge -> +/-0.76 m) spanning visible track. */
export function createRailsGeometry(): BufferGeometry {
	const length = 600; // Covers [-420 m, +180 m]
	const centerZ = -120;
	const railY = -1.0;
	const gaugeHalf = 0.76;

	const left = new BoxGeometry(0.075, 0.14, length);
	left.translate(-gaugeHalf, railY, centerZ);
	const right = new BoxGeometry(0.075, 0.14, length);
	right.translate(gaugeHalf, railY, centerZ);

	const merged = mergeGeometries([left, right]);
	left.dispose();
	right.dispose();
	return merged;
}

/** Wooden track sleeper sitting embedded in the ballast beneath the rails. */
export function createSleeperGeometry(): BufferGeometry {
	return new BoxGeometry(2.5, 0.12, 0.22);
}
