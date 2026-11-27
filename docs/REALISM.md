# Night Train East: Realism Research for three.js

> Status: **research notes, 2026-11-26** (Claude Opus 5.5, cross-checked by Gemini 4 Neon; see §11) · Scope: the one-room MVP (M1 compartment, fixed camera, the girl, birch forest through the window)
> Stack checked against the repo: `three@0.187.0` (WebGLRenderer, WebGL2), `postprocessing@6.39.6`
> Read with: `RENDERING.md` §0 (MVP overrides) and §6 (post stack). §9 below lists where this doc suggests changing that plan.

This doc answers one question: **what makes a three.js scene look photoreal instead of blocky, and which of those things pay off in our compartment on an M1 Air or Iris Xe?**

---

## 1. Summary: the levers, ranked for this scene

Realism in a real-time scene comes almost entirely from **light** (where it comes from, how it bounces, how it is shadowed and occluded) and **surface response** (roughness variation, edges that catch highlights, correct reflections). Polygon count and texture resolution come well behind. The ranking below is for our scene: a small, static, lamp-lit room seen from a camera that never moves.

| # | Lever | Impact | iGPU cost | Where it lives |
|---|---|---|---|---|
| 1 | **Baked GI + AO lightmap from Cycles** (replace the current emissive self-glow) | Very high | Cheap at runtime | §4.1 |
| 2 | **Bevelled geometry with weighted normals** (no raw `BoxGeometry` in final art) | Very high | Cheap | §6 |
| 3 | **Interior environment map** (PMREM of the baked room) so wood, brass and glass reflect the room instead of nothing | Very high | Cheap | §4.2 |
| 4 | **Roughness variation and real PBR texture sets** on every surface | High | Cheap to medium | §5 |
| 5 | **Correct colour pipeline**: sRGB/linear tagging, AgX, half-float buffers, dithering or grain | High (wrong = instantly "CG") | Free | §3 |
| 6 | **Physical material features** where they matter: clearcoat on varnish, sheen on wool, anisotropy on brass | High | Medium per pixel | §5.2 |
| 7 | **Soft, grounded shadows**: one soft lamp shadow and contact darkening under hands, glasses and luggage | High | Medium | §4.4 |
| 8 | **Better anti-aliasing** than FXAA (MSAA or SMAA; temporal AA if we move to WebGPU) | Medium to high | Medium | §7.1 |
| 9 | **The girl**: skin wrap lighting, eye highlights, hair cards with `alphaHash` | Very high, and hardest | Medium | §5.4 |
| 10 | **Photographic post**: restrained bloom on the lamp, fine grain, subtle vignette, LUT grade | Medium | Cheap | §7 |
| 11 | **WebGPU renderer** (TRAA/TAAU, GTAO, SSGI, contact shadows) | Raises the ceiling | Unknown on our hardware | §8 |

If we only do three things: **bake the room in Cycles, bevel everything, and give the room an environment map.** Those three account for most of the gap between "three.js demo" and "photograph."

---

## 2. Why three.js scenes look "blocky" or "CG": the tells

Most of these come from common forum complaints that three.js "looks bad" next to Blender
([three.js forum: photoreal comparison](https://discourse.threejs.org/t/photorealistic-render-comparison-why-does-three-js-look-so-bad/25617),
[render quality vs. glTF viewer](https://discourse.threejs.org/t/render-quality-terrible-compared-to-the-online-glTF-viewer/74420),
[improving vanilla fidelity](https://discourse.threejs.org/t/how-to-improve-vanilla-three-js-fidelity/55837)).
In every thread the cause is configuration and content, not the engine.

| Tell | Cause | Our repo today |
|---|---|---|
| Flat, evenly lit surfaces with no light falloff or corners | No GI or AO; ambient or emissive fill instead of light transport | **Yes**: `carriage.ts` adds `emissive = color × 0.42` to every interior material as a greybox stand-in |
| Razor-sharp 90° edges with no highlight | Unbevelled boxes; real objects always have a rounded edge that catches light | **Yes**: the carriage, luggage and girl are all built from `BoxGeometry` |
| Metals look black or like plastic | No environment map, so there is nothing to reflect | **Yes**: no `scene.environment` is set |
| Washed-out or over-saturated colours | Texture colour space tagged wrong, or tone mapping missing or doubled | OK: AgX runs in post and the renderer uses `NoToneMapping` |
| Uniform "plastic" sheen | Constant roughness per material | Yes (greybox), expected at this stage |
| Shimmering edges and highlights | FXAA only, high-frequency normals without roughness filtering | FXAA only |
| Faceted shading | `flatShading: true` or missing or broken normals | `chunkManager.ts` spruce uses `flatShading: true` |
| Objects that float | No contact shadow or AO where objects touch | Yes |
| Banding in dark gradients | 8-bit buffers, no dithering | OK: half-float composer; no dithering yet |
| Everything in perfect focus with perfect edges | No lens or sensor response | Partly: vignette only |

The greybox status is expected. The point is that **every item in the "Yes" rows needs replacing in final art**. They are what reads as "blocky."

---

## 3. Colour pipeline (free, and mandatory)

A wrong colour pipeline instantly reads as "CG" even with perfect assets.

- **Output**: `renderer.outputColorSpace = SRGBColorSpace` (the default). With `pmndrs/postprocessing`, tone mapping happens in the `ToneMappingEffect`, so the renderer stays on `NoToneMapping`. We already do this. Never tone-map twice. ([pmndrs/postprocessing README](https://github.com/pmndrs/postprocessing))
- **Texture tagging**: albedo/baseColor and emissive are `SRGBColorSpace`. Normal, roughness, metalness, AO and ORM are linear (`NoColorSpace`). `GLTFLoader` sets these for glTF material slots. **Textures we load by hand (lightmaps, frost masks) must be tagged and set to `flipY = false` by us.** A single wrong tag was the whole fix in the [forum's "why does three.js look bad" thread](https://discourse.threejs.org/t/photorealistic-render-comparison-why-does-three-js-look-so-bad/25617).
- **Tone mapper**: keep **AgX** for this scene. It handles saturated tungsten oranges without the ACES "yellow-white" shift. `NeutralToneMapping` (Khronos PBR Neutral) aims at faithful product colours, not a filmic look, so it is the wrong tool here ([Khronos PBR Neutral](https://www.khronos.org/news/cn/khronos-pbr-3d), [three.js forum: tone mapping overview](https://discourse.threejs.org/t/tone-mapping-overview/75204)). Tune **exposure per time of day**, not material brightness.
- **Physical light units**: since r155 three.js uses physically based light units by default, and the legacy mode was removed in r165. `PointLight` and `SpotLight` intensity is in candela with `decay = 2`, and `DirectionalLight` is in lux. Set lights from real values (a 40 W tungsten sconce is about 30–40 cd) and let exposure do the rest. Do not "fix" darkness by boosting materials.
- **Banding**: the night scene is almost all dark gradients, which is where banding shows. We already render to `HalfFloatType` (the main fix, [forum](https://discourse.threejs.org/t/subtle-colour-banding-issue-looks-like-256-colours-when-using-bloom-with-effect-composer/31174)). Also add **dithering**: either a fine grain/noise effect at the end of the merged pass (§7.3), which also adds realism, or `material.dithering = true` on large dark surfaces. Lightmaps go through UASTC, not ETC1S, because ETC1S bands smooth gradients (RENDERING §7.1 already says this).

---

## 4. Lighting

### 4.1 Baked lightmaps (the main lever)

A static room seen from a fixed camera is the best case for baking. Cycles gives us true multi-bounce GI, soft area-light falloff, colour bleeding (warm wood bouncing onto the cream ceiling) and AO, all for the cost of one texture fetch.

**Workflow (Blender 4.x → three.js 0.187):**

1. Model the room with a second UV map for the lightmap: non-overlapping, uniform texel density, ≥ 4–6 px padding at 2048². glTF exports it as `TEXCOORD_1`, which three.js loads as the `uv1` attribute.
2. Bake **Diffuse → Direct + Indirect, colour pass off** (irradiance only, no albedo) to a 32-bit EXR. Baking without albedo keeps lighting and albedo separate, so we can tune materials afterwards and keep 2K albedo detail over a softer lightmap.
3. Denoise the bake (OIDN in the compositor), then dilate.
4. glTF has **no lightmap slot**, so the lightmap ships as a separate texture and gets assigned in code ([forum: lightmap Blender → glTF](https://discourse.threejs.org/t/how-to-setup-lightmap-bake-from-blender-to-gltf/34924)):
   ```ts
   lm.channel = 1;          // sample uv1 (r151+: any texture can use any UV set)
   lm.flipY = false;        // match glTF UV convention
   lm.colorSpace = SRGBColorSpace; // if 8-bit sRGB-encoded per RENDERING §2.1; LinearSRGB if HDR
   material.lightMap = lm;
   material.lightMapIntensity = uLampScale;
   ```
   Since r151–152, `texture.channel` chooses the UV set, and **GLTFLoader leaves every texture on channel 0**, so forgetting `channel = 1` is the most common reason a lightmap "doesn't line up" ([forum: texture.channel](https://discourse.threejs.org/t/documentation-what-exactly-is-texture-channel-for/81168), [forum: wrong UVs](https://discourse.threejs.org/t/lightmap-uses-wrong-uv-in-loaded-gltf-model/57434)).
5. **HDR range**: the lamp hot spot on the wall is far brighter than the room corners. Either keep the planned `lmScale` sRGB encoding (RENDERING §2.1), or use **UASTC HDR KTX2** (`basisu -hdr_4x4`), which three.js has supported since r170 ([Don McCurdy: web texture formats](https://www.donmccurdy.com/2024/02/11/web-texture-formats/)). If we go HDR, test on Safari and Iris Xe first, since device bugs have been reported.
6. **Specular is not baked.** The lightmap only lights the diffuse term, so glossy wood and brass still need an environment map (§4.2) and the one real lamp light for highlights.

**Alternative in-engine bakers** (useful for quick iteration, not final quality): `three/addons/lighting/LightMapper.js` (new in 0.187, **WebGPU only**, bakes a `LightProbeGrid` or VXGI into a lightmap), [three-gpu-pathtracer](https://github.com/gkjohnson/three-gpu-pathtracer)-based bakers ([example write-up](https://milk-website-c76.pages.dev/blog/lightmapping-threejs)), and [react-three-lightmap](https://github.com/pmndrs/react-three-lightmap). Cycles remains the quality bar.

### 4.2 Environment / reflections

Without an environment map, a PBR material has nothing to reflect, so varnish, brass and glass all go dead. The three.js docs say `MeshStandardMaterial` and `MeshPhysicalMaterial` should always have one ([MeshPhysicalMaterial docs](https://threejs.org/docs/pages/MeshPhysicalMaterial.html)).

- **Interior PMREM**: the best source is a **360° HDR equirectangular render from Cycles** at table height inside the finished room, fed to `PMREMGenerator.fromEquirectangular` and set as `scene.environment`. It has the true lamp, bounce and window, all path-traced. The runtime alternative is a one-off `CubeCamera` capture of the lightmapped room, re-run only when the lamp weight changes noticeably. Bake one capture per lighting state (lamp on, dawn) and blend. Until the bake exists, `RoomEnvironment` is a placeholder only: its neutral studio softboxes look wrong on dark walnut and brass at night.
- **Box projection** (parallax-corrected cubemap): in a room 2 m wide, an infinite-distance cubemap puts the reflection in the wrong place. A small `onBeforeCompile` patch that intersects the reflection ray with the room's AABB before sampling makes reflections on the table and brass "stick" to the walls. It costs a few ALU ops and gives a large gain for glossy surfaces in small rooms.
- **`envMapIntensity` per material**: wool about 0.1–0.2, wood about 0.5–0.8, brass and glass about 1.0–1.3 (RENDERING §2.2 values are a fine start).
- **Window glass** keeps the RENDERING §2.3 plan (Fresnel-weighted interior PMREM). That faint reflection of the lamp in dark glass is one of the strongest photographic cues in the M1 reference.

### 4.3 Light probes for the girl and moving props

The girl, the steam and the tea glasses cannot use the lightmap. RENDERING §0 plans a single baked `LightProbe` (L2 spherical harmonics, nearly free). Because she is seated in one spot, **start with that single probe**, placed at her chest height. If her lap or feet look as bright as her face, or the lamp-side vs. window-side difference across her body is too weak, move up: **three 0.187 ships `LightProbeGridWebGL`** (`three/addons/lighting/LightProbeGridWebGL.js`): a 3D grid of L2 spherical-harmonic irradiance probes with a `bake(renderer, scene)` method that **works with `WebGLRenderer`** ([LightProbeGrid docs](https://threejs.org/docs/pages/LightProbeGrid.html)). A coarse grid (for example 4×3×4 over the compartment) gives her light that changes with position: warmer on the lamp side and darker toward the floor. A single probe cannot do that. Bake it once from the lightmapped room. It costs a 3D-texture lookup.

Lighting a face from a single probe or ambient term is a classic cause of a "pasted-in" look. A face needs a **key (the lamp), a fill (probes) and a rim** (cold window light at night). Keep the planned warm lamp rim.

### 4.4 Shadows and contact

- **One real shadow-casting light**: the reading lamp as a `SpotLight` with a 1024² shadow map limited to the table, glasses and girl (RENDERING §0 already allows it if under 1 ms). Fit `shadow.camera` near/far and the spot `angle` tightly around the table so texels stay dense. Use `PCFShadowMap` with `shadow.radius` raised for softness, or `VSMShadowMap` (watch for light bleeding where her arm overlaps the glass). **`PCFSoftShadowMap` is gone**: in 0.187 `WebGLShadowMap` warns that it was removed and falls back to `PCFShadowMap`. Keep `bias ≈ 0` (at most a tiny negative value) and `normalBias` at about 0.01–0.05 to avoid acne and peter-panning ([forum](https://discourse.threejs.org/t/a-way-to-solve-angular-shadow-acne/3484)). **Soft, not crisp**: a lamp shade is an area light, and hard shadow edges read as CG.
- **PCSS** (contact-hardening shadows that are sharp near the contact point and softer further away) is what real lamp shadows look like. In WebGL it is a shader-chunk patch based on the official PCSS example, not a built-in ([forum](https://discourse.threejs.org/t/how-to-do-a-nice-soft-shadow/14427)). Worth it for this one light if it measures well.
- **Contact darkening** where things touch (glass on table, hand on blanket, suitcase on rack) sells weight more than any shadow map. For static props, bake it into the lightmap. For the tea glasses, the [`webgl_shadow_contact`](https://threejs.org/examples/webgl_shadow_contact.html) technique (an upward orthographic depth render, blurred onto a plane) can be **rendered once at load**, or again only when a glass moves, so it costs almost nothing per frame. For the girl's hands, use a small multiplied decal, or N8AO on High (§7.4).
- **No baked shadows from moving things**: the girl should not appear in the lightmap bake. Bake the room without her and let the probe grid and the spot shadow ground her.

---

## 5. Materials and textures

### 5.1 PBR basics that matter most

- **Roughness variation is the single biggest material cue.** Real varnish has fingerprints and wear on edges. Brass is polished where hands touch and duller elsewhere. Wool has no gloss at all. Every material needs a roughness map, not a constant.
- **Use scanned CC0 sets** (Poly Haven, ambientCG) as a base, then tint them to the palette (RENDERING §7.3). Albedo values should stay physically plausible: no pure black or white, wood about sRGB 40–120, snow about 200–230.
- **Texture filtering**: set `texture.anisotropy = min(8, renderer.capabilities.getMaxAnisotropy())` on every texture seen at a grazing angle (floor, table top, walls, blanket). Without it, surfaces at grazing angles blur into mush. It costs little on Apple and Intel iGPUs.
- **Mipmaps on everything** (KTX2 with `--genmipmap`), so distant detail averages correctly instead of shimmering.
- **Detail maps** (a tiled micro-normal for wood grain or wool weave at 4–8× the base tiling, RENDERING §0) keep surfaces sharp at 30 cm from the camera without 8K textures.
- **Specular aliasing**: high-frequency normal maps (wool weave, wood grain) sparkle at distance. three.js already widens roughness from *geometric* normal derivatives (`geometryRoughness` in `lights_physical_fragment`), but that ignores normal maps. It removed `RoughnessMipmapper` in r137 and has no built-in fix for normal-map sparkle ([forum](https://discourse.threejs.org/t/specular-aliasing-with-high-frequency-normal-map-details/73234)). Fix it offline instead: bake **Toksvig-adjusted roughness mips** (raise roughness in each mip where averaged normals shorten, [NVIDIA: Toksvig](https://developer.download.nvidia.com/whitepapers/2006/Mipmapping_Normal_Maps.pdf)) in the asset pipeline. This is a small script in `gltf-transform`. A runtime alternative is a few lines in the material patch: `roughness += (1.0 - length(sampledNormal)) * k`. Also keep a roughness floor of about 0.08–0.12 on curved glossy trim.

### 5.2 `MeshPhysicalMaterial` features worth paying for here

RENDERING §2.2 says to avoid `MeshPhysicalMaterial`. That rule made sense for a whole train. In one room seen from a fixed camera, a few hero surfaces fill most of the frame, and the extra lobes are what make them read as real. Each feature adds per-pixel cost only on the meshes that use it ([docs](https://threejs.org/docs/pages/MeshPhysicalMaterial.html)).

| Surface | Feature | Starting values | Why |
|---|---|---|---|
| Varnished wall panels, table, door | `clearcoat` | `clearcoat 0.7–1.0`, `clearcoatRoughness 0.08–0.2`, base `roughness 0.45–0.6` | Varnish is a clear layer over matte wood. One lobe cannot show both the sharp lamp reflection and the soft grain underneath. This is the "lacquered wood" look in M1. |
| Wool blanket, seat upholstery, curtains | `sheen` | `sheen 1`, `sheenRoughness 0.5–0.8`, `sheenColor` a lighter tint of the albedo | Fabric gets a soft rim brightening at grazing angles. Without it, cloth looks like painted plastic. Needs an env map or a light to show. |
| Brass rails, lamp base, *podstakannik* holder | `anisotropy` + `anisotropyRotation` (or an anisotropy map) | `anisotropy 0.4–0.7`, `roughness 0.25–0.35`, `metalness 1` | Brushed or turned metal stretches highlights along the grain. |
| Tea glass and tea | `transmission` + `thickness` + `ior 1.5` + `attenuationColor` (amber) | `transmissionResolutionScale 0.5` | See below. |
| Window glass | Keep the custom shader (RENDERING §2.3) | | A plain transmission pane would mostly re-render the exterior, so the custom shader is the better tool. |
| Wool, plaster, skin (matte) | `diffuseRoughness` (present in 0.187's `MeshPhysicalMaterial`) | `0.5–1.0` on very matte surfaces | A rough-diffuse BRDF flattens the terminator the way cloth and chalky paint actually do, instead of the Lambert look. |
| Eyes (cornea) | `clearcoat 1`, `clearcoatRoughness ≈ 0.04` | | A crisp catchlight from the env map with no transmission pass. |

**Transmission rethink (disputed, measure first):** RENDERING §2.2 bans `transmission` because it adds an extra pass that re-renders **all opaque objects**, including the exterior forest seen through the window. Early-Z behind the walls limits that cost, and `transmissionResolutionScale = 0.5` halves it. For a hero glass of tea 50 cm from the camera, real refraction (the table and lamp bent through amber liquid) reads as real in a way a Fresnel shell cannot. Gemini's review argues for keeping the shell on Medium because the exterior makes the pass expensive on Iris Xe. **Measure it**: use transmission only on tiers where the pass costs ≤ 1 ms. Otherwise keep the planned two-mesh shell.

### 5.3 Wood, brass, wool, snow: specific tips

- **Wood**: the grain normal should be subtle (strength 0.2–0.4). Lacquer hides most grain relief. Put the grain mainly into albedo and roughness. Add edge wear (lighter, rougher, less clearcoat) on corners that hands touch, using a curvature or AO mask baked in Substance or Blender.
- **Brass**: F0/albedo about `#c9a25e` to `#e0b872`, never yellow-saturated. Add darker oxidised crevices (a cavity mask) and polished high points.
- **Wool and cotton**: roughness 0.85–1.0, no specular "shine," weave detail normal, and *real modelled folds* (§6). Fabric realism is mostly silhouette and folds.
- **Exterior birch**: bark albedo contrast (white with black lenticels) is what reads as birch at night. Use `alphaHash` for leaf/twig cards to avoid sorting artifacts ([forum: alphaTest vs alphaHash](https://discourse.threejs.org/t/alpha-test-vs-alpha-hash/44493)). Remove `flatShading` from the spruce in final art.

### 5.4 The girl (the hardest part)

A face is where viewers are least forgiving. RENDERING §0 currently says "soft painterly skin, no pores or SSS pass." **That conflicts with "as high realism as possible"**, so it is listed as a product question in §9. Options from cheapest to most realistic:

1. **Skin "SSS-lite" in `onBeforeCompile`**: wrap diffuse lighting (light wraps past the terminator) with a red-shifted terminator, plus a **thickness map** that lets the warm lamp bleed through ears and nostrils when backlit. This is cheap and gives most of the effect ([three.js SSS example and forum adaptation](https://discourse.threejs.org/t/subsurface-scattering-with-gltf-model/23629), [tutorial approach](https://masterallarts.pages.dev/learn/threejs-from-zero/s4-06-subsurface-scattering/)).
2. **`MeshPhysicalMaterial` for skin**: `roughness ≈ 0.45–0.55` with a roughness map (oilier T-zone), a small `sheen` for peach fuzz, `specularIntensity` about 0.5 (skin F0 ≈ 0.028). Add a detail normal for pores, used subtly. At 1–1.5 m distance pores read as surface breakup, not individual holes.
3. **Separable screen-space SSS** ([Jimenez et al.](https://www.activision.com/cdn/research/Separable_Subsurface_Scattering_Expanded_Technical_Report_NEW.pdf), about 1 ms on 2015 hardware): the full approach. It is a custom post pass masked to skin, best left for after the WebGPU decision.

**Eyes** make or break a face: a separate cornea mesh with very low roughness so it picks up a sharp catchlight from the lamp or env map, a dark limbal ring, a wet line along the lower lid, and AO in the eye socket. **Hair**: never `transparent: true` on layered cards, because strands sort wrongly. Without temporal AA, `alphaHash` leaves visible stipple. So on WebGL: a sculpted inner hair volume mesh, plus outer stray-strand cards with `alphaTest ≈ 0.45`, `DoubleSide`, and anisotropic highlights along the strands. Use `alphaToCoverage` instead if we enable MSAA (§7.1), and `alphaHash` only with TRAA/TAAU (§8). Add darker roots. Set `frustumCulled = false` (or enlarge the bounds) on skinned hair so head turns don't cull it. **Animation** matters as much as shading: micro head motion, breathing, saccades and blinks (already planned).

**Asset source**: a CC0-compatible base is required (`CREDITS.md`). MakeHuman/MPFB output is CC0. Most commercial character creators are not CC0. Any face-scan base must be checked against the license rule.

---

## 6. Geometry: where "blocky" actually comes from

- **Bevel every hard edge.** Real objects have no perfect 90° edges. A 2–5 mm bevel with 2–3 segments catches a thin line of lamp light along every edge of the table, bunk and panelling. It is the cheapest high-impact change in the whole doc. In Blender: Bevel modifier (by angle) plus **Weighted Normal** modifier (face-weighted), with Auto Smooth, so flat faces stay flat and only the bevel shades round. For greybox, `three/addons/geometries/RoundedBoxGeometry.js` is a drop-in for `BoxGeometry`.
- **Silhouettes need curvature density, not total density.** Spend triangles where outlines curve: the rounded window frame, the lamp shade, the tea glass, the blanket edge, her face profile and hair silhouette. Flat walls can stay at 2 triangles.
- **Real cloth**: blanket, pillow and curtains simulated or sculpted in Blender (cloth sim, then a little sculpt), never flat planes with a normal map. RENDERING §0 already says this. It cannot be faked with textures.
- **Smooth normals that are correct**: no `flatShading`, and **never call `geometry.computeVertexNormals()` on imported glTF meshes** (it overwrites the weighted normals; in Blender, keep Triangulate with *Keep Normals* and export normals). Also export tangents for normal-mapped meshes (or rely on MikkTSpace generation consistently), and weld vertices on smooth surfaces so lighting doesn't show seams.
- **Scale and clutter**: realism comes from "lived-in" imperfection. Add a slightly crooked curtain, a folded newspaper, sugar cubes, a crumpled napkin, scuffs on the floor. These are cheap in triangles and large in believability.
- **Budget**: RENDERING §0 allows ~300k interior tris and 40–60k for the girl. That is plenty; Apple and Intel iGPUs are fill-bound here, not vertex-bound (RENDERING §8.1).

---

## 7. Post-processing and camera response

### 7.1 Anti-aliasing

FXAA (current) blurs texture detail and still crawls on thin bright lines like the luggage-rack wires, brass edges and telegraph wires outside.

- **MSAA ×4 on the half-float composer target** (`EffectComposer({ multisampling: 4 })`): Apple GPUs resolve MSAA in on-chip tile memory, so on the M1 it is often much cheaper than on desktop GPUs. It gives clean geometric edges and enables `alphaToCoverage` for hair and foliage. On Iris Xe it costs more bandwidth. **Measure on both** before choosing; it might become a per-tier setting.
- **SMAA** (`SMAAEffect`, in pmndrs) is the step up from FXAA if MSAA is too expensive: sharper and less blur. Both reviews agree **SMAA should replace FXAA on Medium** if it measures under 1 ms. MSAA is the contested option: cheap on Apple tile GPUs, but bandwidth-heavy on Iris Xe (a 4× half-float target plus a resolve).
- **`TAARenderPass`** (three's WebGL addon) accumulates jitter with no motion vectors, so it only works on static frames. The passing forest and her breathing would smear. Don't use it.
- **Temporal AA** (TRAA/TAA) is the only method that also fixes specular and sub-pixel shimmer. pmndrs v6 has none. The WebGL option, [realism-effects](https://www.npmjs.com/package/realism-effects), is effectively legacy. In three 0.187 **`TRAANode` and `TAAUNode` exist for `WebGPURenderer` only** (§8). With our static camera and mostly static room, TAA would converge almost perfectly; only the window exterior moves.

### 7.2 Bloom

Real lenses glow around bright sources. The reading lamp, the hot spot on the shade and the dawn sun should bloom. Use `BloomEffect` with `mipmapBlur`, a threshold above 1.0 (only HDR highlights) and low intensity (RENDERING §6.1 values). Heavy or low-threshold bloom reads as "game." Ask for half-res bloom on Medium if headroom allows.

### 7.3 Grain, vignette, chromatic aberration, DOF

The [Unity "believable visuals" guide](https://docs.unity3d.com/ru/current/Manual/BestPracticeMakingBelievableVisuals8.html) makes the general point: lens and sensor effects sell realism only when they are subtle, and overdoing them looks amateur.

- **Film grain**: yes. Use a fine, animated, luminance-weighted noise (`NoiseEffect` with a blend at about 2–4% opacity, seeded from `rideT` for determinism). A night photo always has some noise. Grain also hides banding and makes CG surfaces less "clean."
- **Vignette**: yes, subtle (already in).
- **Depth of field**: **off by default.** A photographer focusing on the girl would soften the forest, but PRD Pillar 1 makes the window the main attraction, and DOF also halos the window mullions. If it is tried at all, use a very slight `DepthOfFieldEffect` at half resolution with the focus on the window plane, never on the girl. Strong blur reads as miniature or tilt-shift.
- **Chromatic aberration**: skip, or keep below about 0.5 px at the frame corners only.
- **Lens flares and dirt**: skip. Dirty-window detail belongs in the glass shader (frost and smudges), not on the camera.
- **Exterior motion**: a real camera at 1/30 s would blur near trackside trees at 70 km/h. RENDERING §3.4 avoids a velocity buffer. A cheap alternative is a horizontal directional blur applied only to the exterior layer near the window (or the planned snow streaks). Optional and only worth it if it measures cheap.

### 7.4 Screen-space AO, GI and reflections

- **SSAO / N8AO**: the lightmap already contains AO for static geometry. N8AO is only worth it for **dynamic contact** (the girl on the bunk, glasses on the table). `halfRes` is about 2–4× faster but less stable ([N8AO README](https://github.com/N8python/n8ao)). Keep it on High only, as planned. Not installed yet, so it needs a dependency note per AGENTS.md.
- **SSR**: not needed. Box-projected env maps (§4.2) cover the table and brass more cheaply and without screen-edge artifacts.
- **SSGI**: unnecessary on WebGL with a full bake. On WebGPU it would add dynamic bounce for the girl, at a high cost.

---

## 8. WebGPU / TSL: is it time to switch?

`three@0.187.0` in our `node_modules` already ships these TSL post and lighting nodes for `WebGPURenderer` (`three/addons/tsl/display/*`, `three/addons/lighting/*`):

- `TRAANode` (temporal reprojection AA) and **`TAAUNode`** (temporal AA *plus upscaling*: render at, say, 0.67× and reconstruct to full resolution with a Blackman-Harris resolve, an FSR2-like approach).
- `GTAONode`, `SSGINode` ([docs](https://threejs.org/docs/pages/SSGINode.html)), `SSRNode`, `SSSNode` (screen-space *contact shadows*), `DenoiseNode`, `DepthOfFieldNode`, `FilmNode`, `BloomNode`, `Lut3DNode`, `SMAANode`, `FXAANode`.
- `LightProbeGrid`, `LightMapper` (an in-engine lightmap baker) and VXGI.
- Auto-merged passes with MRT ([WebGPU post-processing manual](https://threejs.org/manual/en/webgpu-postprocessing.html)).

**Why it matters for realism**: TAAU would let us render the heavy frame at ~0.67× resolution, *gain* frame time on the iGPU, and get *cleaner* edges and highlights than FXAA at full resolution. With our static camera it would converge very well. GTAO with temporal filtering and contact shadows would ground the girl and the props.

**Why not yet**: forum reports on r182–r183 show `WebGPURenderer` slower than `WebGLRenderer` on CPU and first frame for many-mesh scenes, plus shadow-quality regressions ([r183 perf report](https://discourse.threejs.org/t/webgpurenderer-2x-slower-cpu-and-5-10x-slower-first-frame-than-webglrenderer-on-many-mesh-scenes-r183-same-on-both-backends/91904), [r182 report](https://discourse.threejs.org/t/webgpu-significant-performance-drop-and-shadow-quality-regression-in-r182-vs-webgl-r170/89322)). Using it also means dropping `pmndrs/postprocessing` and every `onBeforeCompile` patch for TSL. Users have also reported that SSGI gets expensive in large scenes ([forum](https://discourse.threejs.org/t/three-js-webgpu-post-processing-effects/87390)).

**Recommendation**: stay on WebGL for P3 and P4 content work (everything in §3–§6 carries over to either renderer). Run a **time-boxed WebGPU spike** on a branch: the heavy M1 frame on `WebGPURenderer` with TAAU at 0.67× + GTAO + bloom + AgX, measured on the M4 proxy with the `heavy-window-frame` procedure. If it beats the WebGL frame on both quality and p95 time, switch before the art pass hardens the shader patches. RENDERING §9 already keeps material patches in one factory module for exactly this.

---

## 9. Proposed changes to `RENDERING.md` (for owner review)

These are suggestions from this research. None of them is applied to `RENDERING.md` yet.

| Current plan | Suggestion | Reason |
|---|---|---|
| §2.2 "All materials use `MeshStandardMaterial`; avoid Physical" | Allow `MeshPhysicalMaterial` on the hero surfaces: clearcoat on varnished wood, sheen on wool, anisotropy on brass | One room, fixed camera: these surfaces fill the frame and the extra lobes are the realism (§5.2). |
| §2.2 "Never use `transmission`" | Measure half-res transmission for the hero tea glass; keep the shell fallback | The extra pass draws only the cheap interior (§5.2). |
| §0 "Lit by a baked `LightProbe` at her seat" | Keep the single probe; upgrade to `LightProbeGridWebGL` (in 0.187) only if she looks flat | Position-dependent fill, works with WebGL (§4.3). |
| §2.1 / §0 shadows (implied PCF soft) | Use `PCFShadowMap` + `radius` or VSM; `PCFSoftShadowMap` was removed | 0.187 warns and falls back (§4.4). |
| §0 "Soft painterly skin, no pores or SSS" | **Product question (PRD §7)**: the owner asked for maximum realism. Default kept until answered; proposed path is SSS-lite wrap + thickness + physical skin (§5.4) | Conflicts with "as high realism as possible." |
| §6.2 FXAA on Medium | Measure MSAA ×4 on M1 and SMAA on Iris Xe; pick per tier | FXAA is the weakest option for thin bright edges (§7.1). |
| §6.1 post stack | Add fine grain (deterministic seed); keep DOF off | Photographic response, hides banding (§7.3). |
| §2.1 env map is mainly for brass | Make the box-projected interior PMREM the `scene.environment` for every interior material | Every glossy surface needs something to reflect (§4.2). |
| §9 "Future note" on WebGPU | Schedule a time-boxed WebGPU + TAAU spike before P4 | TAAU may buy both quality and frame time (§8). |

---

## 10. Checklist for the art pass

- [ ] No `BoxGeometry`/`flatShading` left in final art; Blender Bevel + Weighted Normal on all hard-surface meshes.
- [ ] Lightmap: Cycles diffuse direct+indirect, no colour, denoised, dilated, `uv1`, `channel = 1`, `flipY = false`, correct `colorSpace`.
- [ ] Emissive "lamp bake" stand-in in `carriage.ts` removed once the lightmap lands (avoid double-counting).
- [ ] Interior PMREM as `scene.environment`, box-projected.
- [ ] `LightProbeGridWebGL` baked for the girl and props.
- [ ] Every material has a roughness map; anisotropic filtering on all floor, table and wall textures.
- [ ] Clearcoat on varnish, sheen on fabric, anisotropy on brass (measured).
- [ ] One soft lamp `SpotLight` shadow (`PCFShadowMap` + radius, VSM, or PCSS), plus baked, render-once or decal contact shadows.
- [ ] Lights in physical units; brightness tuned with exposure only.
- [ ] Dithering or grain on; no banding in the night sky or dark corners on a calibrated display.
- [ ] AA chosen from measurements (MSAA, SMAA or FXAA per tier).
- [ ] Side-by-side against `docs/reference/m1-cozy-cabin.jpg` *and* against a converged [three-gpu-pathtracer](https://github.com/gkjohnson/three-gpu-pathtracer) render of the same scene, which is the "ground truth" for what our materials and lights should produce.
- [ ] Perf: every item above logged in `docs/perf/` with draw calls and p95 frame time (AGENTS.md).

---

## 11. Second opinion: where the two research passes disagreed

This doc was researched by Claude Opus 5.5, then independently by Gemini 4 Neon from the same brief. Gemini's claims were checked against the installed three 0.187 source before merging. They agreed on almost everything (bake first, AgX, bevels and weighted normals, interior PMREM, clearcoat/sheen/anisotropy, SMAA over FXAA, grain, stay on WebGL for now). Open disagreements, each to be settled by measurement or by the owner:

| Topic | Claude | Gemini | Resolution in this doc |
|---|---|---|---|
| Tea glass `transmission` | Measure; likely worth it | Keep the shell; exterior makes the pass expensive | Measure per tier, ≤ 1 ms rule (§5.2) |
| AA on Medium | Measure MSAA ×4 (cheap on Apple) | SMAA; MSAA too costly on Iris Xe | SMAA as baseline, MSAA as per-tier experiment (§7.1) |
| Probe grid | Use `LightProbeGridWebGL` | Overkill for one seated NPC | Single probe first, grid if needed (§4.3) |
| DOF | Gentle DOF on the girl | Skip; blurs the window | Off by default (§7.3) |
| Hair | `alphaHash` | `alphaTest` + inner volume (no TAA on WebGL) | `alphaTest` on WebGL (§5.4) |
| WebGPU | Time-boxed TAAU spike before P4 | Stay on WebGL; no visual benefit for a baked room | Spike stays optional; it is about AA quality and frame time, not GI (§8) |

Gemini corrections adopted: `PCFSoftShadowMap` removal; the transmission pass includes exterior geometry; `TAARenderPass` has no motion vectors; three already applies a geometric roughness term; the Cycles equirect as the PMREM source; render-once contact shadows; `computeVertexNormals` and hair `frustumCulled` pitfalls; `diffuseRoughness` and eye clearcoat.

## Sources

- three.js examples: [contact shadow](https://threejs.org/examples/webgl_shadow_contact.html) · [PCSS](https://threejs.org/examples/webgl_shadowmap_pcss.html) · [subsurface scattering](https://threejs.org/examples/webgl_materials_subsurface_scattering.html) · [physical lights](https://threejs.org/examples/webgl_lights_physical)
- three.js docs: [MeshPhysicalMaterial](https://threejs.org/docs/pages/MeshPhysicalMaterial.html) · [LightProbeGrid](https://threejs.org/docs/pages/LightProbeGrid.html) · [LightProbeGenerator](https://threejs.org/docs/pages/LightProbeGenerator.html) · [SSGINode](https://threejs.org/docs/pages/SSGINode.html) · [WebGPURenderer manual](https://threejs.org/manual/en/webgpurenderer.html) · [WebGPU post-processing](https://threejs.org/manual/en/webgpu-postprocessing.html)
- Local source checked: `node_modules/three` 0.187.0 `examples/jsm/lighting/{LightProbeGridWebGL,LightMapper}.js`, `examples/jsm/tsl/display/{TAAUNode,TRAANode,SSSNode,GTAONode,SSGINode}.js`, `src/renderers/webgl/WebGLShadowMap.js` (PCFSoft removal), `src/renderers/shaders/ShaderChunk/lights_physical_fragment.glsl.js` (geometryRoughness), `src/materials/MeshPhysicalMaterial.js` (diffuseRoughness)
- three.js forum: [photoreal comparison](https://discourse.threejs.org/t/photorealistic-render-comparison-why-does-three-js-look-so-bad/25617) · [render quality vs glTF viewer](https://discourse.threejs.org/t/render-quality-terrible-compared-to-the-online-glTF-viewer/74420) · [improving fidelity](https://discourse.threejs.org/t/how-to-improve-vanilla-three-js-fidelity/55837) · [tone mapping overview](https://discourse.threejs.org/t/tone-mapping-overview/75204) · [AgX implementation](https://discourse.threejs.org/t/is-agx-tonemapping-implemented-correctly/60609) · [lightmap Blender → glTF](https://discourse.threejs.org/t/how-to-setup-lightmap-bake-from-blender-to-gltf/34924) · [texture.channel](https://discourse.threejs.org/t/documentation-what-exactly-is-texture-channel-for/81168) · [lightmap wrong UVs](https://discourse.threejs.org/t/lightmap-uses-wrong-uv-in-loaded-gltf-model/57434) · [specular aliasing](https://discourse.threejs.org/t/specular-aliasing-with-high-frequency-normal-map-details/73234) · [geometric specular AA](https://discourse.threejs.org/t/having-geometric-specular-antialiasing-would-be-incredible/74816) · [banding with bloom](https://discourse.threejs.org/t/subtle-colour-banding-issue-looks-like-256-colours-when-using-bloom-with-effect-composer/31174) · [alphaTest vs alphaHash](https://discourse.threejs.org/t/alpha-test-vs-alpha-hash/44493) · [transparency & hair](https://discourse.threejs.org/t/threejs-and-the-transparent-problem/11553?page=2) · [shadow acne](https://discourse.threejs.org/t/a-way-to-solve-angular-shadow-acne/3484) · [soft shadows](https://discourse.threejs.org/t/how-to-do-a-nice-soft-shadow/14427) · [SSS with glTF](https://discourse.threejs.org/t/subsurface-scattering-with-gltf-model/23629) · [screen-space SSS skin](https://discourse.threejs.org/t/skin-shading-with-screen-space-sub-surface-scattering/83939) · [HBAO vs N8AO](https://discourse.threejs.org/t/new-ambient-occlusion-example-hbao-vs-n8ao/58847) · [WebGPU post effects](https://discourse.threejs.org/t/three-js-webgpu-post-processing-effects/87390) · [WebGPU r183 perf](https://discourse.threejs.org/t/webgpurenderer-2x-slower-cpu-and-5-10x-slower-first-frame-than-webglrenderer-on-many-mesh-scenes-r183-same-on-both-backends/91904) · [WebGPU r182 regression](https://discourse.threejs.org/t/webgpu-significant-performance-drop-and-shadow-quality-regression-in-r182-vs-webgl-r170/89322)
- Libraries: [pmndrs/postprocessing](https://github.com/pmndrs/postprocessing) · [N8AO](https://github.com/N8python/n8ao) · [realism-effects](https://www.npmjs.com/package/realism-effects) · [three-gpu-pathtracer](https://github.com/gkjohnson/three-gpu-pathtracer) · [react-three-lightmap](https://github.com/pmndrs/react-three-lightmap) · [Lightmapping in three.js write-up](https://milk-website-c76.pages.dev/blog/lightmapping-threejs)
- Colour and textures: [Khronos PBR Neutral](https://www.khronos.org/news/cn/khronos-pbr-3d) · [Don McCurdy: choosing web texture formats](https://www.donmccurdy.com/2024/02/11/web-texture-formats/)
- Rendering theory: [Toksvig, Mipmapping Normal Maps (NVIDIA)](https://developer.download.nvidia.com/whitepapers/2006/Mipmapping_Normal_Maps.pdf) · [Separable SSS (Jimenez et al.)](https://www.activision.com/cdn/research/Separable_Subsurface_Scattering_Expanded_Technical_Report_NEW.pdf) · [GPU Gems 3 ch. 14, skin](https://developer.nvidia.com/gpugems/GPUGems3/gpugems3_ch14.html) · [Hashed alpha testing (Wyman)](https://research.nvidia.com/sites/default/files/pubs/2017-02_Hashed-Alpha-Testing/Wyman2017Hashed.pdf) · [Unity: making believable visuals](https://docs.unity3d.com/ru/current/Manual/BestPracticeMakingBelievableVisuals8.html)
