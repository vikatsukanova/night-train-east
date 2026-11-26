import {
	BufferAttribute,
	Color,
	InstancedBufferAttribute,
	InstancedBufferGeometry,
	Mesh,
	NormalBlending,
	ShaderMaterial,
	Vector3,
} from "three";
import { mulberry32 } from "../core/rng";
import { getQualityPreset, type QualityTier } from "./quality";

const SNOW_RENDER_ORDER = 15;
const SNOW_SEED_SALT = 0x51a7_c0de;

export const SNOW_BOX_SIZE = new Vector3(24, 10, 24);

export interface Aabb3 {
	readonly minX: number;
	readonly maxX: number;
	readonly minY: number;
	readonly maxY: number;
	readonly minZ: number;
	readonly maxZ: number;
}

/** Stationary train hull exclusion envelope from docs/RENDERING.md §5.1. */
export const CARRIAGE_EXCLUDE_AABB: Aabb3 = {
	minX: -1.65,
	maxX: 1.65,
	minY: -0.2,
	maxY: 3.4,
	minZ: -13.0,
	maxZ: 13.0,
};

export function isInsideCarriageAabb(
	x: number,
	y: number,
	z: number,
	bounds: Aabb3 = CARRIAGE_EXCLUDE_AABB,
): boolean {
	return (
		x > bounds.minX &&
		x < bounds.maxX &&
		y > bounds.minY &&
		y < bounds.maxY &&
		z > bounds.minZ &&
		z < bounds.maxZ
	);
}

const SNOW_VERTEX_SHADER = /* glsl */ `
attribute vec3 aSeed;
attribute vec4 aParams;

uniform vec3 uCameraPos;
uniform vec3 uBoxSize;
uniform vec3 uExcludeMin;
uniform vec3 uExcludeMax;
uniform float uCarriageHalfWidth;
uniform float uTime;
uniform float uTravelZ;
uniform float uTrainSpeed;
uniform float uWindX;
uniform float uFallSpeed;
uniform float uIntensity;
uniform float uFogDensity;

varying vec2 vUv;
varying float vAlpha;

void main() {
	vUv = uv;

	if (uIntensity <= 0.001) {
		vAlpha = 0.0;
		gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
		return;
	}

	float fall = uFallSpeed * aParams.y;
	vec3 drift = vec3(
		uWindX * uTime,
		-fall * uTime,
		uTravelZ
	);
	vec3 wrapped = mod(aSeed + drift - uCameraPos, uBoxSize) - uBoxSize * 0.5;
	vec3 worldPos = wrapped + uCameraPos;

	// Sinusoidal flutter derived solely from uTime (rideT) and deterministic seed phase.
	worldPos.x += sin(uTime * 1.7 + aParams.x) * 0.25;
	worldPos.z += cos(uTime * 1.3 + aParams.x * 1.37) * 0.12;

	// Exclude particles inside the stationary carriage hull or below the snowbed.
	bool insideCarriage =
		all(greaterThan(worldPos, uExcludeMin)) &&
		all(lessThan(worldPos, uExcludeMax));
	if (insideCarriage || worldPos.y < -0.5) {
		vAlpha = 0.0;
		gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
		return;
	}

	vec3 toCamera = uCameraPos - worldPos;
	float dist = length(toCamera);
	if (dist < 0.35) {
		vAlpha = 0.0;
		gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
		return;
	}
	vec3 viewDir = toCamera / dist;

	// Velocity streak stretch within 5 m of the carriage glass.
	float distFromSide = max(0.0, abs(worldPos.x) - uCarriageHalfWidth);
	float nearGlass = 1.0 - smoothstep(0.0, 5.0, distFromSide);
	float speedFactor = clamp(uTrainSpeed / 16.67, 0.0, 1.5);
	float streakAmount = nearGlass * speedFactor;

	// Cap angular flake size so very close particles never blow up fill rate.
	float baseSize = min(aParams.z, dist * 0.024);

	// Camera basis extracted from viewMatrix rows.
	vec3 camRight = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
	vec3 camUp = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);

	vec3 axisRight = camRight;
	vec3 axisUp = camUp;
	float widthScale = baseSize;
	float heightScale = baseSize;

	if (streakAmount > 0.02) {
		vec3 velocity = vec3(uWindX, -fall, uTrainSpeed);
		vec3 velProj = velocity - viewDir * dot(velocity, viewDir);
		float velLen = length(velProj);
		if (velLen > 0.001) {
			axisRight = velProj / velLen;
			axisUp = normalize(cross(viewDir, axisRight));
			widthScale = baseSize * (1.0 + streakAmount * 4.8);
			heightScale = baseSize * mix(1.0, 0.62, streakAmount);
		}
	}

	vec3 vertexWorld = worldPos + axisRight * (position.x * widthScale) + axisUp * (position.y * heightScale);

	float nearFade = smoothstep(0.45, 1.4, dist);
	float fogFactor = exp(-pow(uFogDensity * dist, 2.0));
	vAlpha = aParams.w * uIntensity * nearFade * fogFactor * mix(1.0, 0.75, streakAmount);

	gl_Position = projectionMatrix * viewMatrix * vec4(vertexWorld, 1.0);
}
`;

const SNOW_FRAGMENT_SHADER = /* glsl */ `
uniform vec3 uSnowColor;

varying vec2 vUv;
varying float vAlpha;

void main() {
	if (vAlpha <= 0.004) discard;
	float r = length(vUv - vec2(0.5)) * 2.0;
	if (r > 1.0) discard;
	float soft = smoothstep(1.0, 0.15, r);
	float alpha = soft * soft * vAlpha * 0.88;
	gl_FragColor = vec4(uSnowColor, alpha);
}
`;

export interface SnowVolumeOptions {
	readonly quality: QualityTier;
	readonly seed: number;
	readonly excludeAabb?: Aabb3;
}

export interface SnowUpdateParams {
	readonly cameraPosition: Vector3;
	readonly rideT: number;
	readonly distanceM: number;
	readonly trainSpeedMps: number;
	readonly snowColor: Color;
	readonly snowIntensity: number;
	readonly fogDensity: number;
}

export interface SnowVolume {
	readonly mesh: Mesh<InstancedBufferGeometry, ShaderMaterial>;
	readonly quadCount: number;
	update(params: SnowUpdateParams): void;
	dispose(): void;
}

/**
 * Generates deterministic per-instance snow attributes for testing and GPU upload.
 * Zero Math.random() calls: seeded exclusively via mulberry32.
 */
export function buildSnowInstanceData(
	quadCount: number,
	seed: number,
): { seeds: Float32Array; params: Float32Array } {
	const rng = mulberry32((seed ^ SNOW_SEED_SALT) >>> 0);
	const seeds = new Float32Array(quadCount * 3);
	const params = new Float32Array(quadCount * 4);
	for (let i = 0; i < quadCount; i++) {
		const s = i * 3;
		seeds[s] = rng() * SNOW_BOX_SIZE.x;
		seeds[s + 1] = rng() * SNOW_BOX_SIZE.y;
		seeds[s + 2] = rng() * SNOW_BOX_SIZE.z;

		const p = i * 4;
		params[p] = rng() * Math.PI * 2; // flutter phase
		params[p + 1] = 0.75 + rng() * 0.6; // fall speed multiplier
		params[p + 2] = 0.024 + rng() * 0.036; // flake diameter (m)
		params[p + 3] = 0.55 + rng() * 0.45; // alpha variation
	}
	return { seeds, params };
}

export function createSnowVolume(options: SnowVolumeOptions): SnowVolume {
	const quadCount = getQualityPreset(options.quality).snowQuads;
	const bounds = options.excludeAabb ?? CARRIAGE_EXCLUDE_AABB;

	const geometry = new InstancedBufferGeometry();
	const positions = new Float32Array([
		-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0,
	]);
	const uvs = new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]);
	const indices = new Uint16Array([0, 1, 2, 0, 2, 3]);
	geometry.setAttribute("position", new BufferAttribute(positions, 3));
	geometry.setAttribute("uv", new BufferAttribute(uvs, 2));
	geometry.setIndex(new BufferAttribute(indices, 1));

	const { seeds, params } = buildSnowInstanceData(quadCount, options.seed);
	geometry.setAttribute("aSeed", new InstancedBufferAttribute(seeds, 3));
	geometry.setAttribute("aParams", new InstancedBufferAttribute(params, 4));
	geometry.instanceCount = quadCount;

	const material = new ShaderMaterial({
		vertexShader: SNOW_VERTEX_SHADER,
		fragmentShader: SNOW_FRAGMENT_SHADER,
		transparent: true,
		depthWrite: false,
		depthTest: true,
		blending: NormalBlending,
		toneMapped: false,
		uniforms: {
			uCameraPos: { value: new Vector3() },
			uBoxSize: { value: SNOW_BOX_SIZE.clone() },
			uExcludeMin: {
				value: new Vector3(bounds.minX, bounds.minY, bounds.minZ),
			},
			uExcludeMax: {
				value: new Vector3(bounds.maxX, bounds.maxY, bounds.maxZ),
			},
			uCarriageHalfWidth: {
				value: Math.max(Math.abs(bounds.minX), Math.abs(bounds.maxX)) - 0.1,
			},
			uTime: { value: 0 },
			uTravelZ: { value: 0 },
			uTrainSpeed: { value: 16.67 },
			uWindX: { value: -0.45 },
			uFallSpeed: { value: 1.85 },
			uIntensity: { value: 1.0 },
			uFogDensity: { value: 0.0065 },
			uSnowColor: { value: new Color(0x8baad4) },
		},
	});

	const mesh = new Mesh(geometry, material);
	mesh.name = "snow-volume";
	mesh.renderOrder = SNOW_RENDER_ORDER;
	mesh.frustumCulled = false;

	const uniforms = material.uniforms as {
		uCameraPos: { value: Vector3 };
		uTime: { value: number };
		uTravelZ: { value: number };
		uTrainSpeed: { value: number };
		uIntensity: { value: number };
		uFogDensity: { value: number };
		uSnowColor: { value: Color };
	};

	return {
		mesh,
		quadCount,
		update(state) {
			uniforms.uCameraPos.value.copy(state.cameraPosition);
			uniforms.uTime.value = state.rideT;
			uniforms.uTravelZ.value = state.distanceM;
			uniforms.uTrainSpeed.value = state.trainSpeedMps;
			uniforms.uSnowColor.value.copy(state.snowColor);
			uniforms.uIntensity.value = state.snowIntensity;
			uniforms.uFogDensity.value = state.fogDensity;
		},
		dispose() {
			mesh.removeFromParent();
			geometry.dispose();
			material.dispose();
		},
	};
}
