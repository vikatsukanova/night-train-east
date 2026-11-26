# Night Train East — Product Requirements

> Status: **Draft v0.1** · Owner: project lead · Last updated: 2026-11-26

## 1. Vision

A slow, calm train ride across a huge country. Birch forests, steppe, snowy towns and dawn
over a lake drift past the window. You wander the carriages as your own visible character, drink
tea from a glass in a metal holder, and share the night with the other passengers. (Talking to them comes after the MVP.) Nothing chases you, and you can't lose.

**Pillars** (each feature should support at least one of these):

1. **The window is the main attraction.** The landscape is the spectacle. It must always look good
   and feel continuous, never like a loop.
2. **Warm inside, cold outside.** Warm lamp light and wood inside, against a vast blue cold
   landscape outside. Most of the art direction comes from this contrast (see `docs/reference/`).
3. **Slow is the point.** No timers, no fail states, and no notifications competing for attention.
   Every interaction is optional.
4. **Small human moments.** Passengers are people with short stories, not quest-givers.

**Reference moments** (concept art in `docs/reference/`):

| ID | Moment | Time | Place | What it shows |
|----|--------|------|-------|---------------|
| M1 | Cozy Cabin | 22:45 night | Compartment (kupe) | Tea glasses, wall lamp, birch forest + snow out the window |
| M2 | Dining Car | 18:30 dusk | Dining car | Passengers at tea, bartender, steppe at sunset |
| M3 | Dawn Over Lake | 05:10 morning | Corridor | Lake + mountains, train curving ahead, brass rails |
| M4 | Snowy Town Stop | 00:15 night | Station platform | Step off at a village halt, station house, lamp posts |

## 2. Target platform & audience

- **Platform:** desktop web browsers (Chrome, Firefox, Safari, latest two versions), hosted on
  GitHub. Mobile and touch are out of scope for the MVP, but the design shouldn't rule them out.
- **Hardware target:** must run at 60 fps on a 2020 integrated GPU (M1 MacBook Air or Intel Iris Xe)
  at 1080p. Larger GPUs get optional quality tiers on top.
- **Audience:** people who play cozy and "walking sim" games, plus people who put on train-ride
  videos to relax. Sessions run 10–60 minutes, so the game must be fine to leave idle.

## 3. MVP scope (v0.1, "One Night")

The MVP is a single continuous ride of **about 25 real minutes**, compressed from dusk to dawn.
It covers moments **M1–M3**. M4 (getting off at a station) comes after the MVP.

> **Naming:** `M1–M4` always means the concept-art *moments* above. Development milestones are
> `P0–P4` (phases), see §6.

### 3.1 Must have (MVP)

| # | Requirement | Acceptance criteria |
|---|-------------|---------------------|
| R1 | **Walkable train, third person**: 2 connected carriages: a **kupe car** (4 compartments off a side corridor, as in M1 and M3) and a **dining car** (M2), joined by a vestibule | **Third-person** over-the-shoulder camera with mouse orbit (pointer lock) and WASD, as in the concept art. The player character is visible with idle, walk and drink animations. The camera never clips through walls in the ~1 m corridor: it pulls in on collision and fades the character out when very close. The player can't leave the train. Doors open with **E** when the character faces them (click only re-captures the mouse). |
| R1b | **Look out the window** | Press **E** at any window to frame a cinematic window view (camera swings beside the character's shoulder toward the glass, as in M3). Any movement key returns to normal control. This keeps Pillar 1 intact in a narrow third-person corridor. |
| R2 | **Moving landscape**: scenery scrolls past every window with no visible tiled loop | 3 biomes: **steppe**, **birch forest**, **lake with mountains**. Seeded per-chunk variation plus occasional landmarks (lit cabin, level crossing, mast). Biome transitions blend over 240 m, with no hard cuts. |
| R3 | **Time of day**: dusk → night → dawn over the ride | Sky, sun/moon, fog and outside light change continuously. Interior lamps come on at dusk. Each of M1–M3 can be reproduced at its listed time. |
| R4 | **Weather**: snowfall | Snow particles outside, toggled per route segment. |
| R5 | **Tea**: get tea from the samovar at the attendant's station and drink it | Take a glass (it attaches to the character's hand), walk with it, drink it in 3 sips via a drink animation. A cosmetic "warmth" vignette. No meters. |
| R6 | **Passengers (ambient, no dialogue)**: the attendant + 3–5 passengers | They make the train feel lived-in: posed or looping idles (sip tea, look out, read, doze). The attendant stands by the samovar. **No talking in the MVP.** NPCs are collision obstacles the player walks around. |
| R7 | **Ambient audio** | Rail-joint clatter **synthesised** from speed (a joint every 25 m), MP3 ambience beds (wind, interior hum) crossfaded per biome, glass clink, a distant horn at crossings. The "Board the train" click unlocks the `AudioContext` (Safari). Master volume control. |
| R8 | **HUD**: minimal, diegetic where possible | Optional location/time caption, as in the concept art ("Birch Forest · Night · 22:45"). An optional compass. Everything hideable (H key). |
| R9 | **Pause / settings menu** | Esc pauses. Settings: volume, mouse sensitivity, invert Y, camera distance (near/far), quality tier (Low/Med/High), FOV. Settings saved in localStorage. |
| R10 | **Fast load** | First interactive frame in < 8 s on a 50 Mbps connection. Initial download ≤ 25 MB, with the rest streamed in. A calm loading screen ("boarding"). |
| R11 | **Save/resume** | Route progress, time of day, player position and held item are saved locally on pause or exit, and resume on reload. Corrupt or incompatible saves are discarded with a one-line notice. |
| R12 | **The dawn shot (M3)**: track visibly curves at the lake | A bent-world scenery shader plus a merged proxy train visible ahead on the curve, and a far-only planar lake reflection (Medium and above). |
| R13 | **End of the ride** | At `rideT = durationSec` the clock holds at 05:10 and the last segment keeps scrolling forever (fine to leave running). An unobtrusive "Ride again" option in the pause menu. |

### 3.2 Should have (MVP if time allows)

- "Sit" interaction on bunks and dining seats, with a fixed comfortable camera at the window (a zen mode).
- Photo mode: free camera inside the train, hide UI, save a PNG.

### 3.3 Out of scope for MVP (later versions)

- **M4 station stops**: getting off onto a platform and a walkable village area. Planned for v0.2.
- **Talking to passengers** (authored Ink dialogue with the attendant and 1–2 passengers). Planned for v0.2.
- Character customisation, first-person camera option.
- More carriages (platzkart open-bunk car, locomotive), voice acting, positional voices.
- Dual baked lightmaps and SSAO. The MVP uses emissive lamps plus at most one bake per car (see RENDERING §2.1).
- Generative / LLM-driven passenger conversations.
- Multiple routes or a route map, achievements, multiplayer "shared carriage".
- Mobile/touch controls, gamepad (gamepad is a cheap v0.2 add).
- Localization beyond English. Strings should still be externalized from day 1.

## 4. Non-functional requirements

| Area | Requirement |
|------|-------------|
| Performance | 60 fps p95 on the target hardware at Medium (internal render resolution capped at 1600×900 until device measurements justify more). ≤ 300 **scene** draw calls (post-FX passes excluded), ≤ 1.5 M triangles on screen, ≤ 512 MB GPU memory. Alpha-card overdraw is the expected bottleneck, so measure it early (P2). |
| Lifecycle | Pause when the tab is hidden or pointer lock is lost. After a stall, the sim catches up by at most 2 fixed steps, so the night never fast-forwards. |
| Stability | No unbounded memory growth over a 60-min idle session (scenery chunks are recycled). |
| Accessibility | Subtitles on by default. Remappable keys (v0.2). A reduced-motion option that disables camera sway and head bob. Text has at least 4.5:1 contrast. |
| Privacy | No analytics or tracking in the MVP. No third-party requests at runtime except the static host. |
| Browser support | WebGL2 is required. WebGPU is optional and can come later. Show a friendly fallback page if WebGL2 isn't available. |
| Content pipeline | All art, audio and (later) dialogue is data in the repo (glTF, KTX2, MP3, JSON), and is either licensed CC0 or CC-BY with attribution in `CREDITS.md`, or original. |

## 5. Success criteria for MVP

- Someone can play the whole 25-minute ride without bugs that break immersion.
- In-game screenshots from third-person camera bookmarks (compartment at 22:45, dining aisle at 18:30,
  corridor window at 05:10) are recognisably close in **mood** to the M1–M3 concept art. The paintings
  set the mood, not a pixel or framing target.
- On target hardware: frame-time p95 < 16.7 ms, and no streaming hitches > 50 ms.
- CI is green, `main` is always deployable, and every visual PR includes screenshots or a clip.

## 6. Roadmap

Phases are `P0–P4` (not to be confused with concept moments M1–M4).

| Phase | Content | Exit criteria |
|-------|---------|---------------|
| **P0 Foundations** | Scaffold, minimal CI (typecheck, lint, unit, build, size check), Pages deploy, PR template | A lit test scene deploys to GitHub Pages from `main`. PRs are gated on CI. |
| **P1 Moving window** | Greybox kupe car along Z, **capsule character + third-person camera rig with wall collision**, 2-D collision, treadmill chunks, birch biome (greybox cones), `FogExp2`, `stats-gl` | Walk the capsule down the corridor without the camera clipping, and watch an endless birch forest at 60 fps. Memory is flat over 10 min. **Boots in desktop Safari** (look around, hear one clack). |
| **P2 The heavy frame, then the route** | First: the worst-case frame (night window, birch cards, snow, fog, tone map + FXAA), **measured on a real iGPU**. Then route JSON, time-of-day, steppe and lake biomes, blends, the bend + lake reflection (R12), audio | The heavy frame holds 60 fps on target hardware *before* biomes 2–3 are built. The full 25-min ride plays end to end. |
| **P3 Life aboard** | Dining car, **player character model + animations** (idle, walk, drink, carry), look-out-window framing, tea, ambient passengers, HUD captions, settings, save/resume, end-of-ride | All R1–R13 pass in greybox/early art. |
| **P4 Look & feel** | Final carriage art, lighting bake, post-FX tuning, quality tiers, cross-browser pass | Mood comparison and perf budget pass. **MVP release `v0.1.0`.** |
| v0.2 | Station stop (M4 concept), **passenger dialogue (Ink)**, gamepad, sit/zen mode, photo mode, dual lightmaps, AI review | |

**First three PRs**

1. `chore/scaffold`: Vite, strict TS, Biome, Vitest, WebGL2 check + fallback page, lit test scene, `base: './'`, CI, Pages deploy from `main`.
2. `feat/walk-corridor`: capsule character, third-person camera rig with collision + fade (Esc/unlock pauses), greybox kupe corridor along Z, 2-D walk polygon, one door on E.
3. `feat/treadmill-birch`: `RouteClock` / `rideT`, 80 m chunks moving toward +Z, seeded birch cones, `FogExp2`, `?t=&seed=` dev params, `stats-gl`. Ten-minute leak check by hand on the owner's machine.

## 7. Open questions

Each question has a proposed default, which we'll use unless someone objects.

1. **First vs third person?** ✅ **Decided (owner): third person**, so you see your character, as in the
   concept art. Cost accepted: a character model, animations, and a collision-aware camera in a ~1 m
   corridor. The "look out the window" framing (R1b) keeps the landscape front and centre.
2. **Setting?** ✅ **Decided (owner): Russia, but never named.** Russian-looking towns, Cyrillic station
   signs, a samovar, glass tea holders, kupe cars. Station and place names are invented but plausible (or
   real-sounding small halts). The game never says "Russia" or "Siberia" in UI text, and there's no flags,
   politics or real-route claims.
3. **Passenger conversations?** ✅ **Decided (owner): none in the MVP**, you just walk around. v0.2 adds
   authored Ink dialogue. Generative chat would need a backend, keys, moderation and cost control,
   which conflicts with a static host.
4. **Art style fidelity?** The concept art is near-photoreal. *Default: "stylised-realistic"*:
   simplified geometry and strong lighting/fog/post-FX doing the heavy lifting. See `docs/RENDERING.md`.
5. **Ride length?** *Default: 25 min* for the MVP, configurable via route data.
6. **PR previews?** ✅ **Decided (owner): none.** Production is on GitHub Pages only. The owner checks out
   branches locally to review, and agents attach screenshots or clips.
7. **Player character look?** *Default:* one stylised adult traveller in a winter coat (as in M3/M4),
   built from a CC0 base (e.g. Quaternius) and re-textured. Customisation is later.
