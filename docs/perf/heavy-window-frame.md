# Heavy Window Frame (`?moment=M1`) — Hardware Measurement Procedure

This note defines the repeatable procedure for measuring the P2 exit check (**60 fps p95, frame time < 16.7 ms, ≤ 300 scene draw calls, ≤ 1.5M triangles, ≤ 512 MB VRAM**) on target integrated GPUs (**M1 MacBook Air** or **Intel Iris Xe**) at **1080p output, Medium tier** (`docs/PRD.md` §4 & §6, `docs/RENDERING.md` §0 & §8.1).

The heavy window frame exercises the worst-case night view through the M1 compartment window:
- Greybox kupe compartment + seated girl
- Birch treadmill scenery (instanced trunks, spruces, poles, sleepers, terrain chunks culled past ~98% fog opacity)
- Analytical night sky dome (gradient + moon glow + stars)
- `FogExp2` (`#112036`, `0.0065`, ~304 m cutoff)
- GPU-instanced falling snow volume (`3000` quads on Medium, 1 draw call)
- `pmndrs/postprocessing` merged uber-pass (`FXAA` + `AgX` tone mapping + `Vignette`, `HalfFloatType`, bloom off on Medium)

## Prerequisites

1. Close unrelated GPU-heavy apps/tabs and disable Low Power Mode / battery saver (note power state in the results table).
2. Use a desktop browser at **1920×1080 CSS viewport** (or full-screen 1080p display). Medium tier automatically caps the internal drawing buffer at **≤ 1600×900** (`docs/RENDERING.md` §6.2).
3. Start the dev server from the repo root (the dev overlay and `window.__NTE__.stats()` are dev-only and stripped from production builds):

```bash
pnpm install
pnpm dev
```

## Step-by-step measurement procedure

1. Open `http://localhost:5173/?moment=M1&quality=medium` in the target browser.
2. Verify the dev overlay in the top-left corner reports:
   - `1600×900 medium` (for a 1920×1080 viewport at DPR ≥ 1)
   - `post 1 (AgX+Vig+FXAA fp16)` (or `u8` if the driver lacks `EXT_color_buffer_half_float`)
   - `snow 3000`
   - `22:45`
3. Click **Board the train** so the treadmill scenery and falling snow are actively moving at 60 km/h (do **not** measure while paused).
4. Let the scene run undisturbed for **10 seconds** to warm shader caches and GPU clocks.
5. Open DevTools Console and reset the rolling 120-frame timing window:

```js
window.__NTE__.resetFrameStats();
```

6. Keep the tab focused and mouse still for **5 seconds** (~300 frames at 60 fps, filling the 120-frame rolling buffer), then capture the snapshot:

```js
console.table(window.__NTE__.stats());
```

7. Record the following fields in the table below:
   - **Scene draw calls** (`sceneCalls`, post passes excluded — budget ≤ 300)
   - **Post draw calls** (`postCalls`, reported separately)
   - **Scene triangles** (`sceneTriangles` — budget ≤ 1.5M)
   - **Frame time p50 / p95 / max** (`frameMedianMs`, `frameP95Ms`, `frameMaxMs` — target p95 < 16.7 ms)
   - **CPU render ms** (`cpuRenderMs`) and **GPU ms** (from the yellow `stats-gl` graph, if `EXT_disjoint_timer_query_webgl2` is exposed by the browser)
   - **Estimated VRAM** (`estimatedGpuMemoryMb`, labeled estimate — budget ≤ 512 MiB)
   - **Visible chunks / pool cap** (`visibleChunks` / `chunkPoolSize`)

### Optional A/B isolation (if p95 ≥ 16.7 ms)

Run the same 10 s warmup + reset + 5 s sample with these URL flags to isolate the bottleneck:
- `?moment=M1&quality=medium&nopost` — isolates post-processing uber-pass cost.
- `?moment=M1&quality=low` — tests `1280×720` internal cap + `1200` snow quads.
- `?moment=M1&quality=high` — tests native resolution + `6000` snow quads + mipmap bloom (for headroom check).

## Target-hardware results (owner to fill)

> Leave blank until measured on physical target hardware. Do not fill from non-target GPUs or headless SwiftShader.

| Hardware & OS | Browser | Power | Viewport / Internal | Quality | Scene Calls | Post Calls | Scene Tris | Frame p50 (ms) | Frame p95 (ms) | GPU (ms) | Est. VRAM (MiB) | Chunks | Pass (<16.7 ms p95)? | Notes |
|---|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---|---|---|
| M1 MacBook Air (macOS) | Chrome | | 1920×1080 / 1600×900 | medium | | | | | | | | | | |
| M1 MacBook Air (macOS) | Safari | | 1920×1080 / 1600×900 | medium | | | | | | | | | | |
| Intel Iris Xe (Windows/Linux) | Chrome | | 1920×1080 / 1600×900 | medium | | | | | | | | | | |
| Intel Iris Xe (Windows/Linux) | Firefox | | 1920×1080 / 1600×900 | medium | | | | | | | | | | |

## Proxy measurement — Mac mini M4 (NOT target hardware)

The owner has no M1 Air or Iris Xe machine, so the frame was measured on a Mac mini M4 as a
**proxy**. These numbers do **not** satisfy the P2 exit check on their own; they show how much
headroom there is. The M4 GPU is roughly 2× an M1 Air's and has more memory bandwidth than Iris Xe.

**Setup (2026-11-26, commit `c1c58af`):** macOS on Mac mini M4 (10-core GPU), Chrome via
`ANGLE Metal Renderer: Apple M4`, mains power, Low Power Mode off, 60 Hz display. Chrome launched
with `--disable-gpu-vsync --disable-frame-rate-limit` so frame time is not clamped to 16.7 ms.
Viewport forced via DevTools `Emulation.setDeviceMetricsOverride` (DPR 1). For each row: load
`?moment=M1&quality=…`, board, warm up 10 s, then 5 × (`resetFrameStats()` + 1 s sample). Frame
times are the median across the 5 samples; "p95 worst" is the worst sample. Train moving at 60 km/h.

| Run | Internal res | Avg fps (uncapped) | p50 ms | p95 ms | p95 worst ms | max ms | Scene calls | Post calls | Scene tris | Est. VRAM MiB | Chunks |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| medium, 1920×1080 | 1600×900 | 595 | 2.3 | 2.7 | 2.8 | 3.6 | 97 | 1 | 405k | 39 | 10/10 |
| medium, 1920×1080, `nopost` | 1600×900 | 606 | 2.3 | 2.6 | 2.7 | 4.0 | 93 | 0 | 405k | 12 | 10/10 |
| low, 1920×1080 | 1280×720 | 731 | 2.1 | 2.7 | 3.0 | 4.0 | 95 | 1 | 401k | 25 | 9/10 |
| high, 1920×1080 | 1920×1080 | 379 | 2.7 | 4.2 | 4.5 | 6.2 | 96 | 17 | 411k | 77 | 10/10 |
| **stress**: high, 2263×1273 (≈2× Medium's pixels, + bloom + 6000 snow) | 2263×1273 | 308 | 3.0 | 4.9 | 5.4 | 6.4 | 96 | 17 | 411k | 107 | 10/10 |

stats-gl GPU timer on the medium run: ~2.4 ms.

**Reading:** Medium p95 is 2.7 ms against a 16.7 ms budget (~6× headroom). The stress run, which
is heavier than "Medium at 2× pixels", stays at 5.4 ms worst-case p95. Draw calls (≤ 97 of 300),
triangles (≤ 0.41 M of 1.5 M) and VRAM estimate (≤ 107 of 512 MiB) are well inside budget.
Even if the target iGPU is 3–5× slower than the M4 at this frame, Medium should stay under 16.7 ms,
but that is an estimate. Iris Xe's bandwidth and alpha-card overdraw behaviour are the main unknowns,
so the target-hardware table above should still be filled when a device is available.
