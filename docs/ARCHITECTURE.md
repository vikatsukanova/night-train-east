# Night Train East — Architecture

> Status: **Draft v0.1** · Read with `PRD.md`, `RENDERING.md`, and `CICD.md`

## 1. Tech stack

| Concern | Choice | Why |
|---------|--------|-----|
| Language | TypeScript, `strict: true` | Agents and humans both benefit from types as guard-rails |
| Bundler / dev server | Vite | Fast HMR, first-class static output for GitHub Pages |
| 3D | three.js (vanilla, `WebGLRenderer`, WebGL2) | Mature and well documented. No React-Three-Fiber: a game loop with hand-owned objects is simpler to reason about and profile |
| Post-FX | `postprocessing` (pmndrs) | Merged effect passes are cheaper than three's EffectComposer chain |
| UI (HUD, menus, subtitles) | Plain DOM + CSS over the canvas, tiny typed components | Very little UI. Revisit (Preact) only if menus grow |
| Collision | Custom 2D walkable-area polygons per carriage | A train is a set of corridors, so a physics engine isn't needed |
| Dialogue (**v0.2**, not MVP) | **Ink** (`inkjs`, compiled `.ink` → JSON at build time with `inkjs/compiler`) | Industry-proven branching narrative, writer-friendly |
| Character animation | three `AnimationMixer` + a tiny clip state machine (idle / walk / drink / carry) | Few clips, so no animation-graph library is needed |
| Audio | Web Audio API via three `AudioListener` + a small mixer. MP3 beds (Safari-safe), synthesised rail clack | No voice files in MVP. `PositionalAudio` only for the samovar and lamps hum |
| Debug | `lil-gui`, `stats-gl`, URL debug params | Dev-only, stripped from production builds |
| Lint / format | Biome | One fast tool; see `CICD.md` |
| Tests | Vitest (unit) + Playwright (smoke / visual) | See `CICD.md` |
| Package manager | pnpm | |

## 2. The core idea: a treadmill world

The train never moves. It sits at the world origin, and **the world moves past it**.

- **No floating-point drift.** A "huge country" ride is thousands of kilometres. If the camera
  stayed near origin while the train actually travelled, coordinates would lose precision. The
  treadmill avoids that.
- **The interior is static**: lightmaps, colliders, NPC positions and audio emitters never move,
  so they're trivial to bake and test.
- The player's position is in **train space** (metres from the train origin).
  The landscape is described in **route space**: `s` = kilometres along the track.

**Frame conventions (frozen, don't change without an ADR):** +Y up. The train's length runs along Z:
**−Z is the direction of travel** (ahead), +Z is behind. +X is lateral (the corridor side of the kupe
car is +X). Carriage origins are placed along Z. Scenery moves toward +Z at train speed. 1 unit = 1 m.

**MVP consist:** `[kupe car][vestibule][dining car]`. The kupe car has 4 compartments off a side
corridor, so it covers both M1 (compartment) and M3 (corridor window). The vestibule is a short
connector mesh with the inter-car doors.

```
           route space (1-D, km along track)
 ─────────┬───────────┬───────────┬───────────┬────────▶ s
  chunk 41 │  chunk 42 │  chunk 43 │  chunk 44 │
           ▲
           train at s = 42.37 km

 world z of a chunk = −(chunk.sStart − train.s) × 1000   (ahead of the train = negative z)
 (train faces −Z; scenery scrolls toward +Z; chunk length 80 m — see RENDERING §3)
```

**Curves.** The track is straight in train space. A **"bent world" vertex shader**
(lateral offset `dx = k(z)·z²` from the route's curve radius) bends scenery beyond ±20 m to fake curves
cheaply. The M3 shot (train visible ahead on a curve) uses a ~6k-tri merged proxy train placed on the
same bend (RENDERING §3.4). It's a must-have (PRD R12) and is built in phase P2.

## 3. Time, speed and the route

Visual speed and story time run on **two separate clocks**:

- **Visual speed** is realistic (45–70 km/h, 12.5–19.5 m/s, set per segment), so the landscape
  moves believably. The route JSON is the **single source of truth** for distance: integrating the
  segment speeds below gives ≈ 24.9 km of generated scenery over 25 minutes.
- **Story clock** is compressed: 18:30 → 05:10 (10 h 40 m) in about 25 real minutes ≈ **25.6× speed**.

Both are driven by one `RouteClock` that advances `rideT` (seconds of real ride time, 0 → ~1500)
and derives everything else from route data:

```ts
// content/routes/one-night.route.json (shape, illustrative)
{
  "id": "one-night",
  "durationSec": 1500,
  "clock": { "start": "18:30", "end": "05:10" },
  "segments": [
    { "id": "steppe-dusk",  "atSec": 0,    "biome": "steppe", "weather": "clear", "speedKmh": 70 },
    { "id": "birch-night",  "atSec": 420,  "biome": "birch",  "weather": "snow",  "speedKmh": 60 },
    { "id": "lake-dawn",    "atSec": 1200, "biome": "lake",   "weather": "clear", "speedKmh": 45, "curveRadiusM": 800 }
  ],
  "blendMeters": 240,
  "events": [
    { "atSec": 300,  "type": "crossing-horn" },
    { "atSec": 600,  "type": "attendant-tea-round" },
    { "atSec": 1100, "type": "landmark", "id": "lit-cabin" }
  ]
}
```

Every other system is a **pure function of `rideT`** plus the seed where possible: the time of day,
the current biome blend weights, the sky keyframes, NPC idle schedules and the
weather intensity. That's what makes "jump to moment M1" possible and the screenshot tests
deterministic.

## 4. Module map

```
src/
  main.ts                 boot: capability check → loader → Game.start()
  core/                   no three.js imports allowed here
    loop.ts               fixed-step update (60 Hz) + variable render, pause handling
    events.ts             typed event bus (EventMap interface)
    clock.ts              RouteClock: rideT, timeOfDay, speed(s)
    rng.ts                seeded PRNG (mulberry32), chunkSeed(routeSeed, chunkIndex)
    save.ts               versioned localStorage save/migrate
    settings.ts           settings store + persistence
    debugParams.ts        ?moment=M1&t=…&seed=…&quality=…&nohud
  content/                data loading, no gameplay logic
    manifest.ts           asset manifest (generated at build), preload groups
    loader.ts             GLTFLoader + KTX2 + meshopt, progress, streaming queue
    route.ts              route schema (zod-validated in dev/tests), segment lookup
  render/
    renderer.ts           WebGLRenderer setup, resize, DPR cap, quality tiers
    post.ts               post-FX chain per tier
    timeOfDay.ts          curve → sun/moon dir, sky params, fog, exposure, LUT blend
    sky.ts, weather.ts
  world/                  the moving outside
    scenery/
      chunkManager.ts     window of N chunks around train.s, recycle + pool
      chunkBuilder.ts     (biome, seed, LOD) → instanced placements
      biomes/             steppe.ts, birch.ts, lake.ts (each a BiomeDef)
      bentWorld.ts        shared curvature shader chunk
    trackside.ts          rails, sleepers, telegraph poles (strongest sense of speed)
  train/
    consist.ts            carriage list + layout (origins along Z, see §2 frame conventions)
    carriage.ts           load interior glTF, colliders, doors, interior lights
    doors.ts, lamps.ts, sway.ts   (sway = subtle camera/interior rocking)
  player/
    controller.ts         third-person movement relative to camera yaw, walk speed, turn smoothing
    cameraRig.ts          orbit camera (pointer lock), shoulder offset, wall collision (ray/sphere-cast
                          against simple colliders), pull-in + character dither-fade when < 0.6 m
    windowView.ts         "look out the window" framing (R1b): blend camera to a window pose
    avatar.ts             player glTF, AnimationMixer, clip state machine (idle/walk/drink/carry)
    collision.ts          2-D walkable polygons + door gates + NPC obstacle circles
    interact.ts           nearest Interactable in front of the character within 1.2 m → prompt (E)
    heldItem.ts           attach tea glass to the hand bone, sip sequence
  npc/
    npc.ts                NPC def: seat/pose, idle clip set, collision circle
    idle.ts               idle behaviour scheduler (sip, look out window, read, doze)
  dialogue/               v0.2: inkRuntime.ts, dialogueUI.ts (folder not created in MVP)
  audio/
    mixer.ts              buses: master / ambience / sfx / voice
    railClack.ts          joint-click scheduler from speed (rail joints every 25 m)
    ambience.ts           crossfades per biome/interior
  ui/
    hud.ts                caption ("Birch Forest · Night · 22:45"), compass
    menu.ts, settingsPanel.ts, loadingScreen.ts
  dev/                    dev-only (tree-shaken in prod): gui, stats, free cam
content/                  source data (not code)
  routes/*.route.json
  biomes/*.json           tunables (density, palettes) — editable without code
public/assets/            optimised runtime assets (glb, ktx2, ogg) — output of the asset pipeline
tests/
  unit/                   vitest
  e2e/                    playwright: boot, moments M1–M3 screenshots, interaction smoke
```

### 4.1 Dependency rules (enforced by Biome `noRestrictedImports` per folder; add `dependency-cruiser` only if that proves too coarse)

- `core/` imports nothing from the other folders and has **no three.js**, so it's unit-testable in Node.
- `content/` depends on `core/` only.
- Feature folders (`world`, `train`, `player`, `npc`, `dialogue`, `audio`, `ui`) may import
  `core`, `content` and `render`, but **not each other directly**. They talk through the event bus
  or through interfaces passed in at composition time (`Game.ts`).
- `dev/` may import anything; nothing may import `dev/` except via a `import.meta.env.DEV` guard.

These boundaries are deliberate: they let **multiple agents work in parallel on different
folders** with few merge conflicts (see `AGENTS.md`).

## 5. Runtime flow

```
boot
 ├─ WebGL2 check ──✗──▶ fallback page
 ├─ load settings + save
 ├─ preload "boarding" group (≤25 MB): carriage interiors, first 2 biomes LOD1, core audio
 ├─ Game.compose()   (wire systems, inject dependencies)
 └─ loop
     fixedUpdate(dt = 1/60)
        clock.advance(dt)              → rideT, s, timeOfDay
        route.update()                 → segment change events, biome weights
        player.update()                → move, collide, interact
        npc.update()
        world.chunks.update(s)         → recycle chunks, enqueue streaming
        audio.update()
     render(alpha)
        timeOfDay.apply()              → sky/fog/lights/exposure uniforms
        scenery.offset = −s            → one uniform/transform, not per-object
        renderer.render() / post.render()
 background: streaming queue loads next biome's assets ~60 s ahead of need
```

### 5.1 Input & lifecycle rules

- **Pointer lock:** click on the canvas acquires lock. Losing lock (Esc, alt-tab, browser UI) →
  `pointerlockchange` → pause menu. Esc never has a second meaning.
- **Interact is E** while locked (the centre-screen prompt shows "E  Take tea"). Mouse click only re-acquires lock, so it can't accidentally both look and act.
- **Hidden tab** (`visibilitychange`) pauses the game and suspends the `AudioContext`. The fixed-step
  loop clamps catch-up to **2 steps** after any stall, so a backgrounded tab never fast-forwards the night.
- **Audio unlock:** the "Board the train" button on the loading screen is the user gesture that
  resumes the `AudioContext` (required by Safari and Chrome autoplay policy).
- **Save:** written on pause, `visibilitychange` and `pagehide`. Load validates the schema version,
  the route id + `durationSec`, and the player position is inside a walkable polygon. On any failure it discards the save and shows a one-line notice.
- **End of ride:** at `rideT ≥ durationSec`, the story clock holds at 05:10 and the final segment keeps
  scrolling indefinitely (procedural chunks continue past the route's end).
- **Stream failure:** if a biome asset group fails or is late, keep generating the current biome and
  retry with backoff. Never stall the train or show an error mid-ride.

## 6. Key interfaces (sketch)

```ts
interface BiomeDef {
  id: BiomeId;
  assets: AssetGroupId;                  // streamed before the biome is needed
  build(ctx: ChunkBuildCtx): ChunkContent; // deterministic from ctx.seed
  palette: { fogNear: number; fogFar: number; groundTint: Color };
}

interface Interactable {
  id: string;
  prompt(): string;                       // "Take tea", "Look out the window"
  canInteract(state: GameState): boolean;
  interact(state: GameState): void;
}

interface SaveV1 {
  version: 1;
  rideT: number;
  playerPos: [number, number, number]; playerYaw: number;
  carriage: CarriageId;
  heldItem: ItemId | null;
  // v0.2 adds: inkState: Record<NpcId, string>
}
```

## 7. Characters & content

- **Player character (MVP):** one stylised adult traveller in a winter coat (concept art M3/M4). Built from a
  CC0 rigged base (Quaternius-style) and re-textured. Clips: idle, walk, turn-in-place, drink, carry-idle,
  carry-walk. Blob-shadow decal under the feet, no realtime shadow.
- **Third-person camera in a narrow train:** the corridor is ~1 m wide and compartments ~2 × 2 m, so the rig
  uses a short boom (1.4–2.2 m) with a right-shoulder offset. It casts against simplified collider boxes
  (not render meshes), pulls in smoothly, and dither-fades the character when the camera gets within 0.6 m.
  At windows, `windowView` takes over for the M3-style shot.
- **Ambient passengers (MVP, no dialogue):** the attendant (provodnitsa) by the samovar, plus 3–5 passengers
  in compartments and the dining car. They share the player's skeleton and clip set where possible, with posed
  or looping idles and a per-NPC tint/outfit variation. Placed via `LOC_` anchors in the carriage glTF.
- **Dialogue (v0.2):** one `.ink` file per speaking NPC, knots unlocked by route events and conditions,
  Ink external functions as the only bridge to the game, compiled with `inkjs/compiler` in a Vite plugin.
  Proposed cast: *Vera* (attendant), *Babushka Nina*, *Arkady* the photographer.
- **Setting:** Russia-inspired, never named (PRD §7.2). Cyrillic signage is art, not UI. UI strings are
  externalised from day 1.

## 8. Testability hooks

- Debug/test hooks below are compiled only into dev builds and the test-only Vite entry (see `CICD.md` §3), never into the deployed `dist`.
- `?moment=M1|M2|M3` sets `rideT`, the player pose and the seed to reproduce each concept frame.
  Playwright screenshots use these hooks.
- `?seed=…&t=…&quality=low&nohud&nopost` for deterministic tests.
- `window.__NTE__` (dev and test builds only) exposes `{ ready: Promise, frame(n), stats() }` so
  tests can wait for "assets loaded + N frames rendered" instead of sleeping.
- Unit tests cover the pure modules: clock maths, segment lookup and blend weights, chunk
  recycling indices, RNG determinism, save migration, collision polygons, rail-clack timing.

## 9. Decision log

| # | Decision | Alternatives considered | Status |
|---|----------|------------------------|--------|
| D1 | Vanilla three.js + TS, no R3F | R3F, Babylon.js, PlayCanvas | Accepted |
| D2 | Treadmill world (train static, scenery moves) | Moving train with floating origin | Accepted |
| D3 | Two clocks: realistic visual speed, compressed story time | Single clock | Accepted |
| D4 | **Third-person** camera with collision + window-view framing | First-person | Accepted (owner decision) |
| D5 | No dialogue in MVP; authored Ink dialogue in v0.2 | Yarn Spinner, custom JSON, LLM chat | Accepted (owner decision) |
| D6 | No physics engine; 2-D walkable polygons | Rapier, cannon-es | Accepted |
| D7 | Static hosting: production on GitHub Pages, PR previews on Cloudflare Pages; no backend | Netlify, Vercel | Accepted (owner decision) |
| D8 | Fake curves via bent-world shader + proxy train ahead (must-have, R12) | True spline track with curved consist | Accepted for MVP |
| D12 | Frame: +Y up, travel toward −Z, consist along Z; MVP consist = kupe car + dining car | 3-car layout with separate corridor car | Accepted (cross-review) |
| D9 | Art source files (.blend, EXR) live outside the runtime repo; plain Git (no LFS) for optimised assets | Git LFS monorepo | Accepted (CICD §5) |
| D10 | Baked dual lightmaps (lamps / window) blended by time of day; no interior shadow maps | Realtime lights + shadows | Accepted (RENDERING §2) |
| D11 | Custom analytical sky dome + AgX + 3D LUT grading via pmndrs/postprocessing | three `Sky` (Preetham), ACES | Accepted (RENDERING §4, §6) |

New architectural decisions get an entry here (or an ADR in `docs/adr/` if longer than a paragraph).
