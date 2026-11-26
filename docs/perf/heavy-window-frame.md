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
