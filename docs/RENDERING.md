# Night Train East — Rendering & Art Direction Plan

> Status: **v0.1 Technical Art Spec** · Scope: MVP (`M1–M3`) with architecture ready for `v0.2` (`M4` station stop)
> Stack: `three.js` (`WebGLRenderer`, WebGL2) · Vite + TypeScript · Static GitHub Pages · **Third-person** camera (over-the-shoulder, collision-aware)
> Budgets: **60 fps @ 1080p output** (M1 Air / Intel Iris Xe, Medium; internal render ≤ 1600×900 until measured) · **≤ 300 scene draw calls** (post passes excluded) · **≤ 1.5M tris** · **≤ 512 MB VRAM** · **≤ 25 MB initial load**

---

## 1. Art Style Target ("Stylised-Realistic")

The four concept images (`docs/reference/m1–m4`) read as near-photoreal at a glance, yet almost none of their emotional weight comes from geometric density. Every frame is carried by **colour temperature contrast** (2700 K varnished wood + tungsten lamps inside vs. cold indigo/slate/pastel landscape outside), **layered atmospheric depth**, and **broad specular roughness separation** (glossy brass & varnished walnut against matte wool, velvet, and snow).

**What carries the look (spend budget here):**
- **Baked warm interior GI & soft bounce** (especially on the curved cream dining-car ceiling in M2 and walnut paneling in M1/M3).
- **Controlled roughness contrast** — brass rails, glass, lacquered wood, and wet/icy lake water catch crisp specular highlights; curtains, upholstery, snow, and distant pines stay broad and matte.
- **Atmospheric layering & colour grading** — exponential distance fog synced to the sky horizon, AgX filmic tone mapping, restrained lamp bloom, and a bespoke 3D LUT per mood.
- **Framing & silhouette clarity** — rounded carriage window frames, dark birch bark stripes against moonlit snow, and crisp foreground telegraph poles.

**What stays cheap (save budget here):**
- **Geometry density** — straight bevelled wood trim, low-poly rounded window frames, flat cloth tables with normal maps, and simple proxy silhouettes for luggage and background dining-car bottles.
- **Foliage detail** — no per-leaf geometry; birches and pines use chunky silhouette cards/clusters with baked trunk-to-canopy ambient occlusion.
- **Dynamic shadows** — zero realtime interior shadow maps; exterior shadows are either disabled (Low/Med) or a single soft directional cascade near the track (High).
- **Characters** — stylised smooth proportions with soft painterly albedo textures and simple rigged idle loops (no pores, hair cards, or subsurface scattering passes).

---

## 2. Interior Rendering

### 2.1 Lighting Strategy: Dual-Channel Baked Lightmaps + Light Probes

> **MVP scope (cross-review):** P1–P3 use emissive lamp materials + hemisphere/probe fill and **at most one**
> `LM_lamps` bake per car. The dual-lightmap blend below is the target design and lands in P4 only if
> time allows (otherwise v0.2). Build the shader hook so adding `LM_window` later is data, not code.

Static train geometry (walls, ceiling, floors, bunks, booths, shelves, fixed fixtures) is **100% lightmapped in Blender Cycles** onto `TEXCOORD_1` (`uv1`). To let interior lamps turn on smoothly at dusk (`M2` → `M1`) and let cool blue/rose exterior light spill through windows (`M3`), we bake **two separate RGB lightmaps per carriage** and blend them in a tiny `onBeforeCompile` patch on `MeshStandardMaterial`:

1. **`LM_lamps` (Interior Practicals):** All wall sconces, ceiling domes, and bar shelf strips baked at 100% intensity (warm ~2700 K), exterior windows blacked out. Driven by scalar uniform `uLampWeight` (`0.0` daytime → `1.0` dusk/night, with gentle per-carriage warm-up curve).
2. **`LM_window` (Exterior Window Bounce):** Pure neutral white sky portal light coming through the windows, interior lamps off. Multiplied in-shader by `uWindowBounceColor` (sampled from the Time-of-Day curve: cool blue at `22:45`, slate-peach at `18:30`, rose-gold at `05:10`).

Final indirect irradiance in the shader is simply:
`irradiance = texture(lmLamps, vUv1).rgb * uLampScale * uLampWeight + texture(lmWindow, vUv1).rgb * uWindowBounceColor + uAmbientFloor;`

- **Lightmap encoding (avoid clamping):** Bake linear Cycles diffuse direct + indirect passes to 16-bit EXR, normalize by a fixed `lmScale` (e.g. `4.0`, stored in carriage metadata), encode as `sRGB` 8-bit PNG → KTX2 UASTC, and multiply back by `uLampScale` in the shader. This preserves bright lamp-sconce falloff on wood without needing expensive 16-bit floating-point textures.
- **Forward-compatibility with `v0.2` (M4 snowy station stop):** When stepping onto the platform outside, never spawn per-window point lights. Instead, swap the train exterior windows to an emissive warm glass shader and project **1 instanced additive light-fan decal** along the snow beside each carriage (matching the iconic warm window bars on snow in `m4-snowy-town-stop.jpg`), plus 2 real `PointLight`s for the station lamp post and doorway.

**Realtime lights inside the carriage (strict budget):**
| Light | Type | Shadows | Purpose |
|---|---|---|---|
| Sun / Moon | `DirectionalLight` (1) | Off (Low/Med), 1024px PCF (High, ext. only) | Exterior terrain/trees + grazing dawn rays through corridor windows |
| Exterior Sky | `HemisphereLight` (1) | None | Sky/ground fill for exterior chunks |
| Carriage Dynamic Fill | `LightProbe` (1 per active carriage, pre-baked SH) | None | Lights dynamic objects (NPCs, held tea glass, opening doors) to match baked wood bounce |
| Local Accent Point | `PointLight` (max 1 active, `decay=2`, `distance=5m`) | None | **Fixed** at a lamp fixture of the active carriage (samovar / bar), never camera-following, which would read as a flashlight. Brass highlights come mostly from the interior PMREM. |

**Total realtime lights active per pixel:** 2–3 non-shadowed (plus 1 exterior directional). Zero shadow maps inside the carriage.

### 2.2 Interior Materials

All materials use `MeshStandardMaterial` (avoid `MeshPhysicalMaterial` except on the hero tea glass if needed, and **never** use `transmission` which forces a full-scene extra render pass).

| Surface | Key Maps & Settings | Look Notes |
|---|---|---|
| **Varnished Walnut / Mahogany** | Trim sheet: Albedo + Normal + ORM (`roughness 0.32–0.52`, `metalness 0.0`), `envMapIntensity 0.6` | Wood grain drives roughness variation; low-angle window light glides softly along the corridor walls (M3). |
| **Brushed Brass (rails, handles, lamp bases)** | Albedo `#c9a25e`, `metalness 0.92`, `roughness 0.24–0.38` (anisotropic-like brushed streak in ORM), `envMapIntensity 1.2` | Driven by a pre-baked **interior PMREM cubemap** (warm room) so brass gleams even with 1 point light. |
| **Velvet / Wool Fabrics (booths, curtains, blanket)** | Albedo + micro-weave Normal + ORM (`roughness 0.88–0.96`, `metalness 0.0`, `envMapIntensity 0.15`) | High roughness kills plastic sheen; subtle dark cavity AO in folds baked into vertex color or ORM.R. |
| **Lamp Shades & Ceiling Domes** | Cream albedo + `emissive` `#ffcf86`, `emissiveIntensity = 2.2 * uLampWeight` | Exceeds bloom threshold (`1.15`) so lamps glow warmly without extra glow sprites. |
| **Hero *Podstakannik* Tea Glass** | **Two meshes, zero transmission pass:** (1) Dark oxidized silver/nickel metal holder (`metalness 0.85, roughness 0.35`, alpha-cutout or modeled filigree cutouts); (2) Amber tea liquid (`#8a2e0b`, faint warm emissive rim) inside a thin additive/alpha-blended Fresnel glass shell (`roughness 0.08`, bright specular highlights + sharp rim). | Renders in 3 draw calls total, looks convincing 30 cm from the camera, and costs zero extra scene passes. |

### 2.3 Window Glass (Reflections, Condensation & Night Mirroring)

Window panes are single-sided quads placed inside the frame with a custom `ShaderMaterial` (or patched `MeshStandardMaterial`) rendered **after** exterior scenery (`transparent: true`, `depthWrite: false`, `renderOrder = 20`):

- **Interior Night Reflection (critical for M1):** Sample a low-res (`128px`) pre-baked **interior-only PMREM cubemap** using the view reflection vector. Weight it by Fresnel (`0.04 + 0.45 * pow(1 - NdotV, 4)`) multiplied by `clamp(uLampWeight - uExteriorLuma, 0.0, 0.75)`. At `22:45` you faintly see the warm cabin and tea lamp reflected in the dark glass; at `05:10` bright dawn outside washes the reflection out naturally.
- **Condensation & Edge Frost:** A single 512px tileable mask texture (`R` = perimeter frost crystals, `G` = subtle vertical wipe/condensation smudges, `B` = ice micro-normal height). Driven by `uFrostAmount` from weather state: frost creeps inward from the rubber gasket edges, boosting opacity (`+0.35`), scattering warm interior light at the rim, and softening the outside view at the corners.
- **Double-pane depth cue:** Offset the reflection cubemap UV slightly to avoid flat wallpaper look; keep centre of pane >92% clear so Pillar 1 ("the window is the main attraction") is never muddied.

---

## 3. Exterior & Window View (The Treadmill World)

The train sits fixed at world origin `(0, 0, 0)` facing `-Z` (keeping floating-point precision rock-solid forever). Exterior scenery lives in a **recyclable ring buffer of chunks** (`chunkLength = 80 m`, 10–12 active chunks spanning `-640 m` ahead to `+240 m` behind) scrolling along `+Z` at train speed `v` (`12.5–19.5 m/s`, 45–70 km/h per route segment; decelerating to `0` for `v0.2` station stops). Chunks entirely beyond the current fog's ~98%-opacity distance are not submitted (night `FogExp2 0.0065` ≈ 300 m), which saves draws and overdraw at night.

### 3.1 Layered Parallax Architecture

| Band | Distance from Track | Contents | Rendering Technique | On-Screen Budget (Med) |
|---|---|---|---|---|
| **Trackside (Near)** | `2–28 m` | Ballast bed, wooden fence/guardrail, snow embankment, telegraph poles + sagging wires, hero birches/pines, snowdrifts | Static merged chunk terrain + `InstancedMesh` poles (every 40 m) & LOD0 trees (`600–1200` tris) | ~180k tris, ~140 instances |
| **Midground** | `28–180 m` | Dense birch/spruce forest, steppe scrub/tussocks, distant farmhouses/lights (rare landmarks) | `InstancedMesh` LOD1 trees (`150–250` tris, shared cross-card canopies) + low-poly terrain strips | ~260k tris, ~1,100 instances |
| **Far Forest & Foothills** | `180–650 m` | Continuous treeline, rolling hills, opposite lake shore (M3) | Alpha-tested instanced billboard cards (`4–8` tris per tree cluster) + coarse terrain mesh (`16×8` grid) | ~45k tris, ~1,800 cards |
| **Horizon Ring (Sky-locked)** | `900–1400 m` | Distant snow-capped mountain ridges (M3), flat steppe horizon haze (M2) | Cylindrical parallax skirt (`32` segments) scrolling at `0.15×` train speed, fading into sky fog | ~8k tris, 2 draw calls |

*Total active triangles across interior (~140k) + NPCs/props (~50k) + exterior (~493k) ≈ **680k triangles** on Medium (< 46% of the 1.5M hard cap).*

### 3.2 Instancing, LOD & Biome Seam Blending

- **One `InstancedMesh` per tree archetype per LOD band** across the entire active ring buffer (rather than per chunk). When a chunk recycles from `+240 m` back to `-640 m`, we overwrite its slice of instance matrices (`instanceMatrix.addUpdateRange(...)`) in <0.2 ms CPU with **zero allocations and zero draw-call growth**.
- **Steppe grass & scrub tufts (M2):** Use 1 `InstancedMesh` of 3-quad crossed tufts (`6` tris each, alpha-tested `alphaTest: 0.45`, gentle vertex wind sway) scattered only within `4–65 m` of the track; smoothly scale instances down to `0` between `50–65 m` in the vertex shader so grass melts into the painted steppe terrain texture with zero pop-in.
- **Anti-repetition (PRD R2):** Chunk placement uses a seeded deterministic PRNG keyed by the **global chunk index along the route** (`chunkSeed(routeSeed, chunkIndex)`, not the ring-buffer slot), randomising yaw, scale (`0.8–1.25`), lean (`±4°`), per-instance colour tint (`instanceColor`, shifting bark brightness and foliage coldness), and rare landmarks (solitary lit cabin, level crossing, distant radio mast).
- **Biome Transitions (240 m / 3-chunk blend zone):**
  1. **Shared edge profile:** Every chunk enforces a deterministic cross-section height curve `h(x)` at its `z = 0` and `z = 80` seams so adjacent chunks stitch cleanly with zero cracks.
  2. **Terrain splat blending:** A 3-channel vertex colour (`R` = snow, `G` = dry steppe grass, `B` = track gravel/soil) interpolates per vertex from the route's `biomeMix(z)` curve.
  3. **Prop density crossfade:** Scatter probability per tree/bush type is multiplied by `biomeMix`, thinning birch trunks organically into open steppe or lakeside spruce over ~12–15 seconds of travel.

### 3.3 Dawn Lake & Reflections (M3)

**Decision: Half-resolution Planar Reflection (`512×256` on Med, `768×384` on High) when the Lake biome is active; analytical sky/horizon reflection on Low.**
- *Why planar over SSR?* SSR breaks down behind corridor window mullions, misses off-screen mountain peaks and sky zenith, and burns too much fragment bandwidth on Iris Xe.
- *Why planar is cheap here:* The mirrored camera renders **only** layer `EXTERIOR_FAR` (sky dome + horizon mountains + opposite-shore treeline + forward curving train silhouette). Interior geometry, snow particles, and near trackside props are skipped completely (< 35 draw calls, < 0.8 ms on M1 Air).
- **Water shader:** Samples the planar RT perturbed by two scrolling low-frequency normal maps (stretched horizontally to match M3's calm lakeside ripples), blends via Schlick Fresnel (`F0 = 0.02`) over a deep glacial blue-slate base (`#1b2b3f`), and adds a soft shoreline snow-foam fade using terrain height delta.

### 3.4 Curving Track, Forward Train Silhouette & Speed Sensation

- **Curving track (M3):** Each chunk's vertex shader (or chunk root transform) applies a gentle lateral spline curvature `dx = k(z) * z²` computed from the route's current curve radius `R` (`400–1200 m`). Keeping the active carriage straight at `(0,0,0)` while smoothly bending chunks beyond `±20 m` lets the player look out the corridor window in M3 and see the embankment and **a 4-carriage low-poly proxy train** (1 merged mesh + emissive window strips, ~6k tris) curving ahead along the shore.
- **Snow ground:** Vertex-displaced chunks with a wind-rippled snow normal map, subtle cool-blue ambient shadow tint (`#4c6b94`), and a view-dependent micro-sparkle term (high-frequency noise thresholded by `pow(NdotH, 32)`) for moonlit/dawn glitter.
- **Speed without full-screen motion blur:** Full-screen velocity-buffer motion blur costs an extra MRT pass and bleeds ugly halos onto stationary window frames. Instead, sell 70 km/h speed with:
  1. **Telegraph poles & fence posts** whipping past at `4–6 m` from the glass every ~2 seconds.
  2. **Track ballast texture UV-scroll** with subtle anisotropic stretching.
  3. **Horizontal streak stretch on near snow particles** (vertex shader elongates quads along the train velocity vector inversely with distance to the window).

---

## 4. Sky & Time of Day

### 4.1 Custom Analytical Sky Dome (Not `three/examples Sky`)

Skip `three/examples/jsm/objects/Sky.js` (Preetham scattering): it produces muddy twilight transitions, cannot represent midnight blue + stars (`M1/M4`), and fights art-directed pastel rose-gold dawn skies (`M3`).

Instead, render a **single back-side sky sphere** (`renderOrder = 10`, depth test `<=`, `depthWrite: false`) with a custom fragment shader driven by **one master Time-of-Day clock** `todHour ∈ [18.5, 29.1667]` (18:30 → 05:10, held at 05:10 after the ride ends):
- **3-stop vertical gradient** (`uZenithColor`, `uHorizonColor`, `uNadirColor`) with exponent shaping (`pow(1 - y, uHorizonSharpness)`).
- **Directional solar/lunar glow:** Smooth Mie lobe around `uSunDir` (`pow(max(dot(dir, sunDir), 0), exp)`) + crisp soft-edged disc for sun/moon.
- **Procedural starfield:** Cell-hashed twinkling stars masked by `(1 - uSkyBrightness) * smoothstep(0.05, 0.35, dir.y)`.
- **Painted/noise cloud band:** One tiling 1024×256 panoramic wispy cloud alpha texture scrolling slowly along the horizon, lit by `uCloudHighlightColor` (apricot at dawn, slate at dusk, near-invisible at night).

### 4.2 Unified Time-of-Day Curve & Reference Keyframes

Every lighting and grading parameter interpolates smoothly (Catmull-Rom / cubic easing) from a single JSON keyframe table (`content/tod-keyframes.json`):

| Param | **M2: Dusk (18:30)** Steppe | **M1: Night (22:45)** Birch Forest | **M4: Night Stop (00:15)** Station *(v0.2)* | **M3: Dawn (05:10)** Lake & Mtns |
|---|---|---|---|---|
| **Sky Zenith** | `#2c3e5e` | `#070d1b` | `#050a16` | `#5d7aa6` |
| **Sky Horizon** | `#d99b7e` (sun side) / `#5a6c85` | `#162742` | `#122038` | `#ffd1b3` |
| **Fog (`FogExp2`)** | `#5d6a7a`, `0.0022` | `#112036`, `0.0065` | `#0f1d33`, `0.0055` | `#d6b8b8`, `0.0018` |
| **Sun / Moon Dir (elev)** | `+2°` (setting, warm `#ffaa70`, `1.2`) | `+38°` (moon, `#6b8fc7`, `0.45`) | `+45°` (moon, `#5e82bd`, `0.40`) | `+4°` (rising, `#ffbf94`, `1.6`) |
| **Ext. Hemisphere** | Sky `#6b7d9e` / Gnd `#383630` (`0.7`) | Sky `#1c3257` / Gnd `#152033` (`0.55`) | Sky `#1a2e4f` / Gnd `#202d42` (`0.5`) | Sky `#c9a8b8` / Gnd `#4a5870` (`0.85`) |
| **Interior `uLampWeight`** | `0.85` (turning warm) | `1.00` (full cozy) | `1.00` (glowing exterior windows) | `0.45` (soft dimmed morning) |
| **`uWindowBounceColor`** | `#7b8ca8` (`× 0.55`) | `#233b63` (`× 0.35`) | `#1f3559` (`× 0.30`) | `#f5c6b3` (`× 0.90`) |
| **Exposure (`renderer`)** | `1.05` | `0.95` | `1.00` | `1.12` |
| **3D LUT Blend** | `LUT_dusk` (warm-slate) | `LUT_night` (amber/indigo split) | `LUT_night` | `LUT_dawn` (pastel peach/periwinkle) |

---

## 5. Weather & Atmospheric Micro-Details

### 5.1 GPU-Instanced Camera-Local Snow Volume

Snow is rendered in **1 draw call** via an `InstancedBufferGeometry` of soft circular billboard quads (no CPU per-particle updates):
- **Toroidal wrapping:** Each particle has a static random seed `(x0, y0, z0)` inside a `28 m × 12 m × 28 m` box around the camera. In the vertex shader:
  `pos = mod(seed + vec3(windX, -fallSpeed, trainSpeed) * uTime - cameraPos, boxSize) - boxSize * 0.5 + cameraPos;`
  plus sinusoidal lateral flutter (`sin(uTime * 1.7 + seed.x * 6.28) * 0.25`).
- **Carriage AABB exclusion:** Each particle checks its world position against the stationary train hull bounding box (`|x| < 1.65 && y > 0.0 && y < 3.4 && z ∈ [trainMinZ, trainMaxZ]`). If inside, collapse vertex scale to `0.0`. Zero snow ever enters the cabin, with zero raycasts or physics.
- **Velocity streaks:** Quads within `5 m` of the carriage side stretch horizontally along `+Z` proportional to `trainSpeed`, creating subtle speed lines against dark birch trunks (M1).
- **Lighting:** Softly tinted by `uSnowLightColor` (moonlit blue `#8baad4` at night, warm pale gold `#ffe2cc` near lit windows in M4, rose-white at dawn).

### 5.2 Window Frost & Tea Warmth Vignette

- **Window frost:** Driven by `weather.snowIntensity` and time spent in cold biomes, smoothly advancing `uFrostAmount ∈ [0.15, 0.75]` in the window glass shader (rim crystals stay out of the sightline centre).
- **Tea "warmth" vignette (PRD R5):** Drinking a sip smoothly pulses a subtle screen-space warm amber edge vignette (`#ffb060`, opacity `0.0 → 0.14`, 8-second decay) combined with a gentle `+0.04` warm shift in the post-processing vignette—purely cosmetic, no HUD bars.

---

## 6. Post-Processing Stack & Quality Tiers

### 6.1 Stack Choice: `pmndrs/postprocessing`

Use **`pmndrs/postprocessing`** (NOT Three's default `EffectComposer`). `pmndrs/postprocessing` automatically merges compatible fragment effects (`ToneMapping`, `LUT3D`, `Vignette`, `BrightnessContrast`) into **one uber-pass**, drastically cutting memory bandwidth and render-target ping-pongs on M1 Air and Intel Iris Xe.

**Pipeline order (HalfFloatType framebuffer, `multisampling: 0`; if `EXT_color_buffer_half_float` is unavailable, e.g. some Safari/ANGLE paths, fall back to an `UnsignedByteType` target + FXAA, no bloom):**
1. **`RenderPass`** — Main scene (`NoToneMapping` on `WebGLRenderer`; handled in post).
2. **`N8AOPostPass` *(High tier only)*** — Half-resolution screen-space ambient occlusion to ground dynamic NPCs, tea cups, and bunks (`halfRes: true`, `aoRadius: 0.6`).
3. **`BloomEffect` (`mipmapBlur: true`)** — `luminanceThreshold: 1.12`, `luminanceSmoothing: 0.25`, `intensity: 0.42`, `radius: 0.65`. Catches only emissive lamp shades, bar bottles, distant cabin windows, and the dawn sun horizon without washing out snow.
4. **Merged `EffectPass`:**
   - **`ToneMappingEffect` (`ToneMappingMode.AGX`)** — Chosen over ACES because AgX preserves warm tungsten amber/mahogany richness and pastel pink dawn skies instead of desaturating bright oranges toward harsh yellow.
   - **`LUT3DEffect`** — 32³ tetrahedral-interpolated `.cube` LUT (two LUTs blended smoothly via `opacity` on biome/ToD changes) for cohesive warm-inside / cold-outside colour separation.
   - **`VignetteEffect`** — Subtle cinematic edge darkening (`darkness: 0.38`, `offset: 0.35`) plus dynamic tea-warmth tint.
   - **`SMAAEffect` (Med/High)** or **`FXAA` / disabled (Low)** — Clean rail, brass, and birch-trunk edges without the MSAA + EffectComposer WebGL2 resolve cost.

### 6.2 Quality Tiers

| Setting | **Low** (Old iGPU / Battery) | **Medium** *(Default — 60 fps M1 Air / Iris Xe)* | **High** (dGPU / M2+ Pro) |
|---|---|---|---|
| **Internal render size** | ≤ 1280×720 | **≤ 1600×900** (raise only after a device log shows p95 < 16.7 ms) | Native (`dpr ≤ 1.75`) |
| **Anti-Aliasing** | FXAA | **FXAA** (SMAA if measured headroom) | SMAA (`Preset.MEDIUM`) |
| **Bloom** | Off (emissive glow halo card on lamps) | **Off initially**; half-res mipmap bloom if measured headroom | Mipmap Bloom (full-res) |
| **SSAO (`N8AO`)** | Off (baked lightmap AO only) | Off (baked lightmap AO only) | Half-res N8AO |
| **Lake Reflection (M3)** | Sky/horizon colour + Fresnel fake | Planar RT `512×256` | Planar RT `768×384` |
| **Exterior Shadows** | Off | Off | 1024px Directional PCF |
| **Snow Particles** | 1,200 quads | 3,000 quads | 6,000 quads |
| **Scenery Draw Distance** | 480 m (6 chunks), 60% tree density | 720 m (9 chunks), 100% density | 960 m (12 chunks), 125% density |
| **Texture Max Mip** | 1024px cap | 2048px cap (hero/lightmaps) | Full resolution |

---

## 7. Asset Pipeline & Sourcing

### 7.1 Blender → glTF → `gltf-transform` Build Pipeline

All runtime assets are compiled via a `pnpm build:assets` script using `@gltf-transform/cli`:
1. **Export from Blender** as `.glb` (Y-up, applied scale, tangents exported only where needed, `uv0` for material trim/tile UVs, `uv1` for non-overlapping baked lightmaps with ≥ 4 px padding at 1024px).
2. **Optimize with `gltf-transform`:**
   - `dedup`, `prune`, `weld`
   - **Geometry compression:** **`meshopt`** (`gltf-transform meshopt`) across all assets. Prefer Meshopt over Draco because Meshopt decodes ~5–10× faster in WASM (preventing >50 ms streaming hitches during biome transitions) and preserves vertex cache locality.
   - **Texture compression (KTX2 / Basis Universal):**
     - **UASTC + Zstd (`--uastc --zstd 18`)**: Normal maps, dual baked lightmaps (`LM_lamps`, `LM_window`), and window frost masks — eliminates blocky gradient banding on smooth curved ceilings and wood normals.
     - **ETC1S (`--etc1s --quality 160`)**: BaseColor/albedo and packed ORM (`R`=AO, `G`=Roughness, `B`=Metalness) maps — achieves 6–10× smaller downloads to comfortably stay under the **≤ 25 MB initial load**.

```bash
# Reference asset compilation pipeline (run via pnpm build:assets)
gltf-transform optimize in.glb tmp.glb --compress meshopt --texture-compress false
gltf-transform uastc tmp.glb tmp2.glb --slots "{normalTexture,emissiveTexture}" --zstd 18
gltf-transform etc1s tmp2.glb out.glb --slots "{baseColorTexture,metallicRoughnessTexture,occlusionTexture}" --quality 160
# Standalone lightmaps & frost masks encoded directly via ktx / toktx:
toktx --t2 --encode uastc --uastc_quality 2 --zstd 18 --genmipmap t-kupe-lm-lamps.ktx2 t-kupe-lm-lamps.png
```

### 7.2 Texture Size Rules & Naming Conventions

| Asset Category | Max Resolution | Compression | Notes |
|---|---|---|---|
| Carriage Trim Sheets (wood, brass, fabric) | `1024×1024` (max `2048` for hero wood) | ETC1S (BC/ORM), UASTC (Normal) | Shared across both carriages to slash VRAM & draw calls |
| Carriage Baked Lightmaps (2 per carriage) | `1024×1024` (8-bit sRGB scaled by `lmScale`, KTX2 UASTC — see §2.1) | UASTC | 1 texel ≈ 2.5 cm on walls; plenty for soft tungsten bounce |
| Hero Props (*podstakannik*, samovar, compass) | `512×512`–`1024×1024` | ETC1S / UASTC (N) | Packed onto 1–2 atlases |
| NPCs (3 characters) | `1024×1024` per NPC | ETC1S | Stylised smooth shading needs no 2K skin maps |
| Exterior Trees / Terrain / Snow | `512×512` (foliage atlas `1024×1024`) | ETC1S | Shared biome atlas for single-draw-call instancing |

**Naming & Repo Layout:**
- **Source files (never deployed to GitHub Pages):** Keep `.blend`, Substance/Krita masters, and raw EXR lightmap bakes **outside the runtime repo** (separate art-source repo, per `CICD.md` §5). Only compiled, optimised outputs live in `public/assets/`.
- **File naming (kebab-case):** `kupe-carriage.glb`, `dining-car.glb`, `prop-podstakannik.glb`, `env-birch-kit.glb`, `t-wood-walnut-bc.ktx2`, `t-wood-walnut-n.ktx2`, `t-wood-walnut-orm.ktx2`, `t-kupe-lm-lamps.ktx2`.
- **Node/Mesh prefixes inside Blender:** `SM_` (static mesh), `SK_` (skinned NPC), `COL_` (collision box, stripped from render), `LOC_` (anchor empties for lamps, seats, NPCs, doors).

### 7.3 CC0 Sourcing vs. Custom Modeling

| Strategy | Assets | Sources & Adaptation |
|---|---|---|
| **Source CC0 + Re-texture** | Wood, velvet, wool, snow, birch bark, gravel PBR maps; twilight/night HDRIs for Blender baking | **Poly Haven** & **ambientCG** (downscale to 1K, tint to unified warm/cold palette, pack ORM). |
| **Source CC0 + Decimate/Edit** | Suitcases, teapots, plates, bottles, base pine/birch/bush silhouettes, wooden village huts *(v0.2)* | **Quaternius** & **Kenney** (re-UV onto shared trim/biome atlases so they batch into existing draw calls). |
| **Model Custom (Blender)** | **2 carriages + vestibule** (kupe car with side corridor, dining car; consistent window height & doorways), **hero *podstakannik* tea glass + samovar**, **player character + attendant + 3–5 passengers (shared rig, CC0 base re-textured)**, **telegraph poles & exterior curved-train proxy** | These define the game's identity and require exact first-person scale, clean lightmap UVs, and modular snapping. |

---

## 8. Performance Plan & Budgets

### 8.1 Draw-Call Strategy (Target: ≤ 180 typical, ≤ 300 hard cap, scene draws only)

> **Expected real bottleneck: fill rate, not triangles.** Alpha-tested tree cards, grass tufts, snow quads and the post
> chain at 1080p are what will hurt Iris Xe. P2 starts by building and measuring that worst-case frame on a real iGPU
> (night window + birch cards + snow + fog + tone map + FXAA) before more biomes are built.

- **Interior merging by trim material:** Merge static carriage architecture per carriage per material in Blender (`wood`, `cream-ceiling`, `brass`, `fabric`, `glass`, `emissive-lamp`). Each carriage renders in **~18–25 draw calls** (MVP consist of 2 cars + vestibule ≈ 50 draw calls; with door culling, usually only 1 car draws).
- **Repeated interior props:** Dining-car tables, chairs, curtains, plates, saucers, and wall sconces use **`InstancedMesh`** (or `THREE.BatchedMesh` for mixed tableware/bottles sharing 1 atlas) — **~15 draw calls** for the entire dining car dressing.
- **Exterior scenery:** 1 `InstancedMesh` per tree/bush/pole archetype + 1 merged mesh per active terrain chunk = **~35–55 draw calls** total.
- **NPCs & dynamic props:** player + attendant + 3–5 passengers (2–3 draw calls each; blob-shadow decals, no shadow maps) + held tea glass (3) + snow (1) + sky (1) + lake (1) = **~15 draw calls**.
- **Expected total inside dining car looking out:** **~110–150 draw calls** (50% headroom under the 300 cap).

### 8.2 Occlusion, Early-Z & Streaming

Exploit the fact that **carriage walls hide 65–80% of the exterior pixels**:
1. **Front-to-back render order (Free Early-Z rejection):** Render opaque carriage interiors FIRST (`renderOrder = 0`), then NPCs (`1`), then exterior terrain/trees (`5`), then sky dome (`10`), then lake water (`12`), then snow (`15`), then interior window glass (`20`). Hardware Early-Z discards exterior fragment shading behind every wooden wall.
2. **Carriage door portal culling:** Track which carriage the player occupies. If the connecting vestibule door to the non-adjacent carriage is closed, set that carriage's `visible = false` (cuts 1/3 of interior tris & draw calls).
3. **Window-cone & lake-pass culling:** Run the M3 planar lake reflection render pass **only** when (a) the Lake biome is active AND (b) at least one lake-side window bounding box intersects the camera frustum.
4. **Zero-hitch streaming (≤ 25 MB initial load):**
   - **Initial bundle (~16–20 MB):** App code + WebGL/KTX2/Meshopt workers (~1.2 MB), 2 carriages + vestibule + trim sheets + lightmaps (~7 MB), NPCs + tea props + UI (~3 MB), initial biome kit (Steppe + Birch, ~4 MB), core audio (~2.5 MB).
   - **Lookahead streaming:** 60 seconds before a biome change (e.g. approaching Lake), `fetch` the next biome `.glb` + `.ktx2` off the main thread via Web Worker decoders, upload textures 1-per-frame, and call `renderer.compileAsync(biomeGroup, camera)` so shader compilation never causes a >50 ms spike. Call `.dispose()` on exited biome textures once 2 chunks behind.

### 8.3 GPU Memory Budget (Medium Tier, Target ≤ 512 MB)

| Category | Allocation | Notes |
|---|---|---|
| Carriage Trim Sheets & Props (KTX2) | `~45 MB` | GPU-compressed BC7/ASTC stays resident |
| Baked Lightmaps (≤ 4 × 1024² UASTC) | `~12 MB` | 2 carriages × up to 2 maps (MVP: 1 each) |
| NPCs & Tea Hero Assets | `~15 MB` | player + NPCs + podstakannik + samovar |
| Active Exterior Biomes (max 2 loaded at seam) | `~55 MB` | Trees, bark, terrain, horizon clouds, snow |
| Geometry Buffers (interior + chunk pool + instances) | `~35 MB` | Recycled ring buffer; zero growth over 60 min |
| Framebuffers (1080p HDR + Bloom mips + SMAA + Planar RT) | `~58 MB` | Half-float main RT + mip chain + 512×256 lake RT |
| **Total Estimated VRAM** | **`~226 MB`** | **< 45% of 512 MB hard cap** (safe headroom for Safari/ANGLE overhead) |

### 8.4 Frame-Time Budget (16.6 ms @ 60 fps, 1080p Medium on M1 Air / Iris Xe)

| Pass / Stage | Budget (ms) | Primary Lever if Over Budget |
|---|---|---|
| CPU JS (treadmill scroll, ToD, NPC idle, culling) | `≤ 2.0 ms` | Keep chunk recycles zero-alloc (`addUpdateRange`) |
| Planar Lake Reflection RT *(M3 lake only)* | `≤ 1.0 ms` | Drop RT to `384×192` or update every 2nd frame |
| Opaque Interior + NPCs (`renderOrder 0–1`) | `≤ 3.5 ms` | Merge static trim meshes; cull closed carriages |
| Opaque Exterior + Sky (`renderOrder 5–12`) | `≤ 4.0 ms` | Early-Z behind interior walls; trim LOD0 tree radius |
| Transparents (Snow + Window Glass, `15–20`) | `≤ 1.5 ms` | Cap snow quad screen size; keep glass single-pane |
| Post-FX (`Bloom` + merged `AgX/LUT/Vignette/SMAA`) | `≤ 3.0 ms` | Drop bloom to quarter-res or switch SMAA → FXAA |
| **Total Frame Time (p95 target < 16.7 ms)** | **`≤ 15.0 ms`** | **~1.6 ms thermal/browser compositor headroom** |

### 8.5 Profiling & Measurement

- **In-app dev overlay (`?debug=1`, dev builds only):** Integrate **`stats-gl`** (tracks real GPU frame time via `EXT_disjoint_timer_query_webgl2` alongside CPU ms & FPS) plus a compact readout of `renderer.info.render.calls`, `triangles`, `memory.geometries`, and `memory.textures`.
- **Deep inspection:** Capture M1/M2/M3 frames in **Spector.js** to verify Early-Z ordering, confirm `pmndrs/postprocessing` pass count (≤ 5 full-screen passes on Medium), and audit accidental redundant state changes.
- **Automated perf gate (CI / manual checklist):** Fixed camera bookmarks for M1, M2, and M3 plus a 10-minute accelerated treadmill soak test verifying `renderer.info.memory.textures` and `geometries` remain strictly flat (zero leaks).

---

## 9. Key Risks, Mitigations & Greybox-First Milestone Plan

### 9.1 Top Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| **Shader / KTX2 compile stutter on biome entry** | >50 ms frame hitch breaks calm mood | Pre-warm exterior materials with `renderer.compileAsync()` at load/lookahead; use a single shared uber-shader across biomes with texture/uniform swaps instead of distinct shader programs. |
| **Lightmap UV seams or dark leaks at modular joins** | Visible stripes on wood walls & curved ceilings | Author continuous carriage hulls per car (not tiny wall tiles) for `uv1` lightmap unwrapping; bake with 6 px dilation padding and UASTC compression. |
| **Window glass sorting / overdraw artifacts** | Snow or lake disappears behind glass | Strict `renderOrder` hierarchy (`opaque interior < exterior < sky < water < snow < window glass`), `depthWrite: false` on glass, single pane per window. |
| **Planar lake reflection exceeding 16.7 ms on Iris Xe** | Frame drops during M3 climax | Strict layer mask (`EXTERIOR_FAR` only), `512×256` cap on Medium, automatic skip when camera faces away from windows, and Low-tier sky-Fresnel fallback. |
| **Uncanny NPC faces in warm dim light** | Breaks cozy human moments (Pillar 4) | Lean into soft stylised proportions (like M1/M2), warm `LightProbe` fill to prevent harsh under-eye shadows, subtle blink & teacup sip animations instead of lip-sync. |
| **Download bloat past 25 MB** | Fails R10 (< 8 s load) | Enforce Vite bundle + `public/assets` size check in CI; strictly ETC1S for non-normal textures; stream Lake biome lazily after departure. |

### 9.2 "Greybox First" Progression (Aligned to PRD phases P1–P4)

Do **not** wait for final Blender assets to prove the atmosphere. Lock lighting, treadmill parallax, and frame-time budgets on greybox geometry first:

1. **P1 — Moving Window (Greybox + 1 Biome):**
   - Build untextured greybox corridor + kupe with accurate window openings, a capsule player and the third-person camera rig with wall collision.
   - Implement the stationary-origin treadmill ring buffer (80 m chunks), seeded `InstancedMesh` birch cylinder/cone proxies, passing telegraph poles, and `FogExp2` night lighting.
   - Wire `stats-gl` + `renderer.info` overlay; verify **60 fps and flat memory** over a 10-min run.
2. **P2 — The Heavy Frame, then the Route (Atmosphere & Transitions):**
   - **First**, build the worst-case night frame and measure it on target hardware. Only then continue.
   - Add the custom analytical sky dome, unified Time-of-Day curve (`18:30 → 05:10`), biome seam blending (Steppe → Birch → Lake), GPU-instanced snow with carriage AABB culling, and the half-res M3 planar lake reflection + curved-track vertex bend.
   - Check that greybox screenshots at `18:30`, `22:45`, and `05:10` are heading toward the palettes of `docs/reference/m1–m3` (colour and value only; the final grade arrives in P4).
3. **P3 — Life Aboard (Dynamic Props & Characters):**
   - Drop in blockout/early custom *podstakannik* tea glass, samovar, the player character (skinned, ~6 clips), the attendant and ambient passengers, lit via per-carriage `LightProbe` + 1 fixed accent `PointLight`.
   - Implement window glass shader (night interior reflection + frost mask) and tea-warmth vignette hook.
4. **P4 — Look & Feel (Art Pass, Bake & Polish):**
   - Swap greybox carriages for final custom Blender carriages with trim-sheet PBR materials and **dual-channel Cycles lightmaps** (`LM_lamps` + `LM_window`).
   - Run full `gltf-transform` (Meshopt + KTX2) pipeline, tune the `pmndrs/postprocessing` chain (AgX + 3D LUT + vignette, bloom/SMAA only where measured headroom allows), tune Low/Med/High tiers on M1 Air / Iris Xe, and sign off via side-by-side comparison against `m1-cozy-cabin.jpg`, `m2-dining-car.jpg`, and `m3-dawn-lake.jpg`.

*(Future note: keep all custom shader patches isolated in a small `materials/` factory module so migrating from `WebGLRenderer` + GLSL `onBeforeCompile` to Three.js `WebGPURenderer` + TSL Node Materials post-MVP requires rewriting only 4 material factories, not scene logic.)*
