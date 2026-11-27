export type QualityTier = "low" | "medium" | "high";

export interface QualityPreset {
	readonly tier: QualityTier;
	readonly maxWidth: number;
	readonly maxHeight: number;
	readonly maxDpr: number;
	readonly bloom: boolean;
	readonly snowQuads: number;
	readonly maxSceneryDistanceM: number;
}

export const DEFAULT_QUALITY_TIER: QualityTier = "medium";

/** Quality tier parameters from docs/RENDERING.md §6.2. */
export const QUALITY_PRESETS: Readonly<Record<QualityTier, QualityPreset>> = {
	low: {
		tier: "low",
		maxWidth: 1280,
		maxHeight: 720,
		maxDpr: 1.0,
		bloom: false,
		snowQuads: 1200,
		maxSceneryDistanceM: 480,
	},
	medium: {
		tier: "medium",
		maxWidth: 1600,
		maxHeight: 900,
		maxDpr: 1.75,
		bloom: false,
		snowQuads: 3000,
		maxSceneryDistanceM: 720,
	},
	high: {
		tier: "high",
		maxWidth: Number.POSITIVE_INFINITY,
		maxHeight: Number.POSITIVE_INFINITY,
		maxDpr: 1.75,
		bloom: true,
		snowQuads: 6000,
		maxSceneryDistanceM: 960,
	},
};

export function getQualityPreset(tier: QualityTier): QualityPreset {
	return QUALITY_PRESETS[tier];
}

export function parseQualityTier(
	raw: string | null | undefined,
): QualityTier | undefined {
	if (!raw) return undefined;
	const normalized = raw.trim().toLowerCase();
	if (
		normalized === "low" ||
		normalized === "medium" ||
		normalized === "high"
	) {
		return normalized;
	}
	if (normalized === "med") return "medium";
	return undefined;
}
