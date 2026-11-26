# Night Train East — Product Requirements

> Status: **Draft v0.1** · Owner: project lead · Last updated: 2026-11-26 (one-room MVP)

## 1. Vision

A slow, calm train ride across a huge country. Birch forests, steppe, snowy towns and dawn
over a lake drift past the window. The MVP is one warm compartment at night: a girl sits wrapped in a
blanket by the window, tea glasses rattle on the table, and the landscape slides past. (Walking the train
and meeting other passengers come after the MVP.) Nothing chases you, and you can't lose.

**Pillars** (each feature should support at least one of these):

1. **The window is the main attraction.** The landscape is the spectacle. It must always look good
   and feel continuous, never like a loop.
2. **Warm inside, cold outside.** Warm lamp light and wood inside, against a vast blue cold
   landscape outside. Most of the art direction comes from this contrast (see `docs/reference/`).
3. **Slow is the point.** No timers, no fail states, and no notifications competing for attention.
   Every interaction is optional.
4. **Small human moments.** People on the train (in the MVP, just the girl) feel alive, not like props or quest-givers.

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

## 3. MVP scope (v0.1, "One Compartment")

> **Scope change (owner, 2026-11-26):** the MVP is cut down to **one room**: a single kupe compartment
> (moment **M1**), seen from a **fixed camera**, with **one NPC**, a girl sitting on the lower bunk, while the
> landscape passes the window. The whole quality budget goes into making that one frame as realistic as
> possible. Walking, the third-person player character, the dining car, the corridor and the M3 lake shot
> move to later versions. The walkable greybox and third-person rig already on `main` stay in the repo but
> are not part of the MVP experience.

The MVP is a single continuous ride of **about 25 real minutes**, compressed from dusk to dawn, watched
from inside one compartment. The defining frame is **M1 at 22:45** (`docs/reference/m1-cozy-cabin.jpg`).

> **Naming:** `M1–M4` always means the concept-art *moments* above. Development milestones are
> `P0–P4` (phases), see §6.

### 3.1 Must have (MVP)

| # | Requirement | Acceptance criteria |
|---|-------------|---------------------|
| R1 | **One kupe compartment, fixed camera** | The camera sits roughly where M1 is framed from (near the door, looking toward the window, the girl on the right). The mouse gives a **gentle look-around** (about ±25° yaw, ±12° pitch, eased, springs back to centre when idle). No walking, no pointer lock required. The compartment is fully modelled where the camera can see it: window, fold-down table, two lower bunks, upper bunk edges, luggage racks with bags, wall lamp, door side. Nothing outside the camera's view needs to exist. |
| R2 | **Moving landscape**: scenery scrolls past the window with no visible tiled loop | **Birch forest is the must-have biome.** Seeded per-chunk variation plus occasional landmarks (a lit cabin, a level crossing, a mast). Telegraph poles and wires sell speed. Steppe and lake biomes are should-haves (§3.2). |
| R3 | **Time of day**: dusk → night → dawn over the ride | Sky, sun/moon, fog and outside light change continuously. The wall lamp comes on at dusk. M1 (22:45) is the reference frame and must be reproducible exactly. |
| R4 | **Weather**: snowfall | Snow particles outside the window, with speed streaks close to the glass. |
| R5 | **The girl (one NPC)** | A seated young woman on the right-hand lower bunk, wrapped in a plaid blanket and knitted scarf, as in M1. Looping idle: breathing, blinking, slow head turns toward the window, occasionally lifting a tea glass to sip. She is the highest-detail asset in the scene. **No dialogue, no interaction.** |
| R6 | **Realistic interior lighting** | Interior lighting is **baked** (Blender Cycles lightmap) for the compartment at full quality, with the wall lamp as the key light, plus a light probe so the girl matches the room. Filmic tone mapping (AgX) and a colour grade. See RENDERING §2. |
| R7 | **Ambient audio** | Rail-joint clatter **synthesised** from speed (a joint every 25 m), a wind/interior hum bed, the occasional tea-glass rattle on the table. The "Board the train" click unlocks the `AudioContext` (Safari). Master volume control. |
| R8 | **HUD**: minimal | Optional caption, as in the concept art ("Birch Forest · Night · 22:45"). Hideable with H. |
| R9 | **Pause / settings menu** | Esc pauses. Settings: volume, look sensitivity, quality tier (Low/Med/High). Saved in localStorage. |
| R10 | **Fast load** | First interactive frame in < 8 s on a 50 Mbps connection. Initial download ≤ 25 MB. A calm loading screen ("boarding"). |
| R11 | **Resume** | Route progress and time of day are saved locally on pause or exit and resume on reload. Corrupt or incompatible saves are discarded with a one-line notice. |
| R12 | **End of the ride** | At `rideT = durationSec` the clock holds at 05:10 and the last segment keeps scrolling forever (fine to leave running). An unobtrusive "Ride again" option in the pause menu. |

### 3.2 Should have (MVP if time allows)

- Steppe and lake biomes with 240 m blends, so the dusk and dawn parts of the ride look different from the night.
- Window glass with a faint reflection of the warm compartment at night and frost creeping in from the edges.
- Small life in the room: the carriage sways slightly, the tea in the glasses trembles, the lamp flickers once in a while.
- Photo mode: hide UI, save a PNG.

### 3.3 Out of scope for MVP (later versions)

- **Walking, the third-person player character, collision, doors**: the code on `main` is parked, not deleted.
- **The corridor, other compartments, the dining car (M2)** and other passengers.
- **The M3 dawn lake shot** (curving track, proxy train ahead, planar reflection). The lake biome may still pass the window as a should-have.
- **Tea interaction** (taking and drinking tea yourself).
- **M4 station stops**, talking to passengers (Ink dialogue), generative conversations.
- Multiple routes, achievements, multiplayer, mobile/touch controls, gamepad.
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

- Someone can leave the 25-minute ride running and nothing breaks the mood.
- A side-by-side of the in-game frame at `?moment=M1` and `docs/reference/m1-cozy-cabin.jpg` is close in
  **mood and realism**: warm lamp-lit wood, a believable girl in a blanket, a cold moonlit birch forest
  with falling snow outside. The painting sets the target; matching it pixel for pixel isn't required.
- On target hardware: frame-time p95 < 16.7 ms, and no streaming hitches > 50 ms.
- CI is green, `main` is always deployable, and every visual PR includes screenshots or a clip.

## 6. Roadmap

Phases are `P0–P4` (not to be confused with concept moments M1–M4). P0 and P1 are done (scaffold,
walkable greybox, birch treadmill). From P2 onward the plan follows the one-room scope.

| Phase | Content | Exit criteria |
|-------|---------|---------------|
| **P0 Foundations** ✅ | Scaffold, CI, Pages deploy | Done. |
| **P1 Moving window** ✅ | Greybox kupe car, third-person rig, birch treadmill, `RouteClock`, `stats-gl` | Done. The walking parts are now parked. |
| **P2 The frame** | Fixed M1 camera with gentle look, a greybox compartment built around that view, the heavy window frame (birch cards, snow, fog, sky, tone map + FXAA) **measured on a real iGPU**, time of day dusk → dawn | `?moment=M1` shows the right composition and colours in greybox at 60 fps on target hardware. |
| **P3 The room and the girl** | Modelled compartment + props in Blender, the first lightmap bake, real materials (wood, brass, fabric, glass), the girl (model, blanket, scarf, idle + sip animation), light probe, audio | The scene reads as M1 with final-ish assets. All R1–R12 pass. |
| **P4 Realism pass** | Bake tuning, colour grade (LUT), window reflection + frost, room micro-motion, quality tiers, cross-browser pass, should-haves if time allows | Mood comparison and perf budget pass. **MVP release `v0.1.0`.** |
| v0.2+ | Walking + corridor (third-person code already exists), dining car (M2), dawn lake shot (M3), station stop (M4), dialogue | |

**Next three PRs**

1. `feat/fixed-cabin-camera`: a fixed camera at the M1 viewpoint with eased mouse look, `?moment=M1`, walking disabled in the boot flow (code kept).
2. `feat/compartment-greybox`: rebuild the greybox compartment around the M1 view (window size and height, table, bunks, racks, lamp), plus a greybox seated figure for the girl.
3. `feat/heavy-window-frame`: night sky, fog, snow and tone mapping through the window, measured on target hardware.

## 7. Open questions

Each question has a proposed default, which we'll use unless someone objects.

1. **Camera?** ✅ **Decided (owner, 2026-11-26): fixed camera in one compartment** for the MVP, with gentle
   mouse look. The earlier third-person walking decision moves to v0.2; that code stays in the repo.
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
7. **The girl's look and style?** *Default:* as in M1: a young woman with dark hair in a low bun, pink knitted
   scarf, green plaid blanket, wool socks. Realistic proportions with soft, slightly painterly skin (no pores
   or subsurface pass). Built from a CC0/CC-BY base and re-textured, or modelled in Blender. Open: will the
   owner model her, commission her, or use a base character?
8. **She is an NPC** ✅ **Decided (owner):** the player is an unseen viewer. She never reacts to the player.
