import {
	BackSide,
	Color,
	MathUtils,
	Mesh,
	ShaderMaterial,
	SphereGeometry,
	Vector3,
} from "three";
import type { TimeOfDayState } from "./timeOfDay";

const SKY_RADIUS_M = 650;
const SKY_RENDER_ORDER = 10;

const SKY_VERTEX_SHADER = /* glsl */ `
varying vec3 vWorldDir;

void main() {
	vWorldDir = position;
	vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
	gl_Position = projectionMatrix * mvPosition;
}
`;

const SKY_FRAGMENT_SHADER = /* glsl */ `
uniform vec3 uZenithColor;
uniform vec3 uHorizonColor;
uniform vec3 uFogColor;
uniform vec3 uGlowColor;
uniform vec3 uCelestialDir;
uniform vec3 uCelestialColor;
uniform float uGlowStrength;
uniform float uGlowPower;
uniform float uDiscCosInner;
uniform float uDiscCosOuter;
uniform float uStarVisibility;
uniform float uTime;
uniform float uSeedOffset;

varying vec3 vWorldDir;

float hash31(vec3 p) {
	p = fract(p * vec3(443.8975, 397.2973, 491.1871));
	p += dot(p, p.yzx + 19.19);
	return fract((p.x + p.y) * p.z);
}

vec3 hash33(vec3 p) {
	p = fract(p * vec3(443.897, 441.423, 437.195));
	p += dot(p, p.yxz + 19.19);
	return fract((p.xxy + p.yxx) * p.zyx);
}

float valueNoise2D(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	f = f * f * (3.0 - 2.0 * f);
	float a = hash31(vec3(i, 0.0));
	float b = hash31(vec3(i + vec2(1.0, 0.0), 0.0));
	float c = hash31(vec3(i + vec2(0.0, 1.0), 0.0));
	float d = hash31(vec3(i + vec2(1.0, 1.0), 0.0));
	return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float starLayer(vec3 dir, float scale, float density, float time) {
	vec3 scaled = dir * scale + vec3(uSeedOffset, 0.0, -uSeedOffset * 0.7);
	vec3 cell = floor(scaled);
	vec3 f = fract(scaled);
	vec3 rnd = hash33(cell);
	if (rnd.x < density) return 0.0;
	vec3 offset = 0.2 + 0.6 * rnd;
	float dist = length(f - offset);
	float size = mix(0.045, 0.125, fract(rnd.y * 13.7));
	float core = 1.0 - smoothstep(size * 0.15, size, dist);
	float twinkle = 0.74 + 0.26 * sin(time * (1.1 + rnd.z * 2.2) + rnd.y * 62.8318);
	return core * core * twinkle * mix(0.45, 1.0, fract(rnd.z * 7.3));
}

void main() {
	vec3 dir = normalize(vWorldDir);
	float y = max(dir.y, 0.0);

	// 3-stop vertical gradient: fog horizon -> sky horizon -> zenith.
	float horizonWeight = pow(1.0 - y, 3.2);
	vec3 sky = mix(uZenithColor, uHorizonColor, horizonWeight);

	// Subtle procedural wispy cloud/haze band near the upper horizon (no texture fetch).
	vec2 cloudUv = dir.xz / (y + 0.22) * 1.35 + vec2(uTime * 0.0025 + uSeedOffset * 0.1, -uTime * 0.0012);
	float n1 = valueNoise2D(cloudUv);
	float n2 = valueNoise2D(cloudUv * 2.3 + vec2(4.7, 2.1));
	float clouds = smoothstep(0.42, 0.82, n1 * 0.65 + n2 * 0.35);
	float cloudMask = smoothstep(0.03, 0.22, dir.y) * (1.0 - smoothstep(0.18, 0.65, dir.y));
	sky = mix(sky, mix(uHorizonColor, uGlowColor, 0.35), clouds * cloudMask * 0.28);

	// Directional solar/lunar atmospheric Mie glow + soft celestial disc.
	float cosTheta = dot(dir, uCelestialDir);
	float glow = pow(max(cosTheta, 0.0), uGlowPower) * uGlowStrength;
	float horizonBoost = mix(0.55, 1.25, pow(1.0 - y, 2.0));
	sky += uGlowColor * glow * horizonBoost;

	float disc = smoothstep(uDiscCosOuter, uDiscCosInner, cosTheta) * smoothstep(-0.01, 0.025, dir.y);
	sky += uCelestialColor * disc * 1.45;

	// Deterministic procedural starfield masked by night visibility and elevation above horizon fog.
	if (uStarVisibility > 0.005 && dir.y > 0.025) {
		float starMask = uStarVisibility * smoothstep(0.035, 0.11, dir.y) * (1.0 - clouds * cloudMask * 0.55);
		float s1 = starLayer(dir, 130.0, 0.962, uTime);
		float s2 = starLayer(dir, 240.0, 0.972, uTime * 1.25);
		vec3 starTint = mix(vec3(0.78, 0.88, 1.0), vec3(1.0, 0.95, 0.86), hash31(floor(dir * 130.0)));
		sky += starTint * (s1 * 1.15 + s2 * 0.55) * starMask;
	}

	// Seamless lock to FogExp2 color at and below the horizon line.
	float fogLock = smoothstep(0.0, 0.055, dir.y);
	vec3 finalColor = mix(uFogColor, sky, fogLock);

	gl_FragColor = vec4(finalColor, 1.0);
	#include <colorspace_fragment>
}
`;

export interface SkyDome {
	readonly mesh: Mesh<SphereGeometry, ShaderMaterial>;
	update(tod: TimeOfDayState, cameraPosition: Vector3, rideT: number): void;
	dispose(): void;
}

export function createSkyDome(seed = 1986): SkyDome {
	const geometry = new SphereGeometry(SKY_RADIUS_M, 32, 20);
	const material = new ShaderMaterial({
		vertexShader: SKY_VERTEX_SHADER,
		fragmentShader: SKY_FRAGMENT_SHADER,
		side: BackSide,
		depthWrite: false,
		depthTest: true,
		fog: false,
		toneMapped: false,
		uniforms: {
			uZenithColor: { value: new Color(0x070d1b) },
			uHorizonColor: { value: new Color(0x162742) },
			uFogColor: { value: new Color(0x112036) },
			uGlowColor: { value: new Color(0x2d4e80) },
			uCelestialDir: { value: new Vector3(-0.67, 0.62, -0.42).normalize() },
			uCelestialColor: { value: new Color(0x6b8fc7) },
			uGlowStrength: { value: 0.24 },
			uGlowPower: { value: 14 },
			uDiscCosInner: { value: Math.cos(MathUtils.degToRad(0.85)) },
			uDiscCosOuter: { value: Math.cos(MathUtils.degToRad(1.3)) },
			uStarVisibility: { value: 1.0 },
			uTime: { value: 0 },
			uSeedOffset: { value: ((seed >>> 0) % 1024) * 0.17 },
		},
	});

	const mesh = new Mesh(geometry, material);
	mesh.name = "sky-dome";
	mesh.renderOrder = SKY_RENDER_ORDER;
	mesh.frustumCulled = false;

	const uniforms = material.uniforms as {
		uZenithColor: { value: Color };
		uHorizonColor: { value: Color };
		uFogColor: { value: Color };
		uGlowColor: { value: Color };
		uCelestialDir: { value: Vector3 };
		uCelestialColor: { value: Color };
		uGlowStrength: { value: number };
		uGlowPower: { value: number };
		uDiscCosInner: { value: number };
		uDiscCosOuter: { value: number };
		uStarVisibility: { value: number };
		uTime: { value: number };
	};

	return {
		mesh,
		update(tod, cameraPosition, rideT) {
			mesh.position.copy(cameraPosition);
			uniforms.uZenithColor.value.copy(tod.skyZenith);
			uniforms.uHorizonColor.value.copy(tod.skyHorizon);
			uniforms.uFogColor.value.copy(tod.fogColor);
			uniforms.uGlowColor.value.copy(tod.skyGlow);
			uniforms.uCelestialDir.value.copy(tod.celestialDir);
			uniforms.uCelestialColor.value.copy(tod.celestialColor);
			uniforms.uGlowStrength.value = tod.celestialGlowStrength;
			uniforms.uGlowPower.value = tod.celestialGlowPower;
			const discRad = MathUtils.degToRad(tod.celestialDiscRadiusDeg);
			uniforms.uDiscCosInner.value = Math.cos(discRad * 0.78);
			uniforms.uDiscCosOuter.value = Math.cos(discRad * 1.18);
			uniforms.uStarVisibility.value = tod.starVisibility;
			uniforms.uTime.value = rideT;
		},
		dispose() {
			mesh.removeFromParent();
			geometry.dispose();
			material.dispose();
		},
	};
}
