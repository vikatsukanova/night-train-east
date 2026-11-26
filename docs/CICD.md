# Night Train East CI/CD and pull requests

This is the implementation plan for the browser game described in [the PRD](PRD.md).
P0 ends with a small WebGL scene running on GitHub Pages and
working quality gates. The pipeline must stay cheap enough to run on every push to a PR.

## 1. Branches, commits, and merges

- Use trunk-based development. Start from `main`, keep one change per short-lived branch,
  and open a draft PR early if the work spans multiple sessions.
- Name branches `<type>/<short-description>` or `<type>/<issue-id>-<short-description>`,
  for example `feat/42-birch-streaming`, `fix/audio-resume`, or `ci/pages-deploy`.
- Use Conventional Commits for PR titles and squash commits. Use a scope when it helps,
  as in `feat(rendering): blend biomes at route boundaries`. Intermediate commits may be WIP.
- Enable squash merging only. Default the squash subject to the PR title and keep useful context
  in the body. Delete merged branches automatically. Keep `main` linear.
- Each agent opens PRs using its own authorized GitHub identity. If a tool acts as the owner,
  the resulting PR counts as owner-authored. Never give an agent the owner's GitHub credential.
- The owner performs the merge. Before requesting final review, update the branch if `main`
  advanced. Keep broad formatting passes, dependency upgrades, and asset re-exports in focused PRs.

## 2. Protection and review on main

Apply two active branch rulesets to `main` so solo-owner PRs have a review exception
while still passing all technical gates.

- **Main integrity.** Require a PR, resolved review conversations, linear history, and passing
  `ci / required` from GitHub Actions. Require the branch to be up to date before merging.
  Block force pushes and deletion. Set zero approvals in this ruleset and leave its bypass list empty.
- **Main review.** Require one approval and code-owner review. Dismiss stale approvals on
  reviewable changes. Give the sole human admin a **For pull requests only** bypass on this
  ruleset. Keep all agent and automation identities out of the bypass list.
- Put `* @OWNER` in `.github/CODEOWNERS`, replacing the placeholder with the owner's GitHub
  handle. This covers CI, test fixtures, budgets, snapshots, dependencies, and CODEOWNERS itself.
- The owner reviews and approves separately authored agent PRs after the final update. For an
  owner-authored PR, record the final head SHA, verification, and reason for the review bypass
  in the PR. GitHub prevents self-approval. Keep approval-of-the-last-push off so the owner can
  still approve an agent-authored PR after updating its branch. AI review is advisory.
- Leave merge queue and auto-merge off. With one merger, strict up-to-date checks and small PRs
  are enough.

See [GitHub ruleset layering and availability](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets),
[PR-only bypass](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/creating-rulesets-for-a-repository),
and [GitHub review rules](https://docs.github.com/en/pull-requests/how-tos/review-pull-requests/approving-a-pull-request-with-required-reviews).

## 3. PR checks

Run on `pull_request` targeting `main` for opened, reopened, synchronize, ready-for-review,
and edited events. Check out the synthetic merge commit and record its SHA alongside the PR
head and base SHAs. Cancel superseded CI runs per PR. Run the same gates on pushes to `main`
against the actual squash commit. Use GitHub-hosted Linux, a pinned Ubuntu image for
non-browser jobs, and a pinned Playwright Linux image for the browser job.

1. **`ci / quality` · 2–4 min.** Install the pinned Node LTS patch and pnpm version.
   Cache only the pnpm store keyed by OS, architecture, Node, pnpm, and lockfile hash.
   Run `pnpm install --frozen-lockfile` on every run (30–90 s warm). Check PR title
   convention on PRs. Run strict `tsc --noEmit` (15–45 s), `biome ci` for lint and
   formatting (5–20 s), then `vitest run` (15–60 s). Keep route and save-state logic in
   fast unit tests. Local scripts expose these same commands without auto-fixing in CI.
2. **`ci / package` · 2–4 min, after quality.** Restore the store and install, validate
   assets and credits (20–90 s), build with Vite (20–60 s), then run the static size gate
   (5–20 s). Publish `dist` from that build for the later browser and deploy jobs.
   Include budget totals, top contributors, and asset validation results in the run summary.
3. **`ci / browser` · 3–5 min, after package.** Serve `dist` under
   `/night-train-east/` and run a brief boot check. Check out the
   same tested SHA and use the locked tools to build the rendering fixture. Run boot
   and cold-load checks first (30–90 s), then visual comparisons and performance
   counters (1–3 min). The budget includes setup and collecting failure evidence.
   Use one Chromium worker for the rendering tests.
4. **`ci / required` · <10 s, after all three.** Always run the aggregator, including
   when a dependency fails or is skipped. Succeed only when all three jobs succeeded.
   Use a unique, stable name and register the exact context GitHub shows. Avoid workflow
   path filters so even a docs-only PR reports the required result.

Budget **7–13 min** end to end on warm runners, excluding queue time. Set per-job timeouts
of 8, 10, and 12 min for quality, package, and browser respectively. Hold PR deploy
artifacts and test failure evidence for seven days. Keep browser traces, actual/expected/diff
PNGs, and renderer diagnostics on failure. Use shallow checkout by default and fetch only
the comparison base when a changed-file report needs it.

### Initial payload

- Define startup as a fresh visitor on Medium with no save, from navigation through the
  first interactive frame. Keep streaming behind an explicit startup boundary. Count
  requests initiated before that boundary even if they complete afterward.
- Budget **750 KiB gzipped initial JS**, **22,000,000 bytes of initial non-code assets**,
  and **25,000,000 bytes total**. Use deterministic gzip on the initial JS set for the JS
  budget and raw emitted sizes for the aggregate and asset gates. The raw aggregate is a
  conservative bound on response body payload even on a host serving identity encoding.
- Walk the Vite entry and static import/preload graph with the build manifest and add
  declared startup dynamic imports and asset dependencies. Include HTML, CSS, fonts,
  workers, decoder/WASM files, the first scene, and any eager audio or textures.
  Deduplicate by emitted path and fail on missing manifest entries or files.
- In Playwright, start from a fresh context with browser caching and service workers
  disabled. Compare observed requests to the inventory, confirm they use the local
  site origin, and account for every unexpected startup fetch. Fail on an undeclared
  startup fetch, repeated body download, failed response, or budget overrun. Keep the
  static inventory and runtime check in sync when moving a load to a streaming phase.
- The PRD's **<8 s at 50 Mbps** is a release acceptance measurement. Record cold-load
  timings in CI for diagnosis and measure the requirement on physical target hardware
  with the network shaped to 50 Mbps, a cold cache, and the production build.

### Asset validation

- Run the pinned Khronos glTF Validator for runtime `.gltf` and `.glb`; block errors
  and report warnings. Check external references against files in the same repo and
  reject missing files, remote URLs, and path escapes. Recheck dependents when a shared
  texture or buffer changes. Prefer GLB for packaged models and local external KTX2
  where reused textures benefit from sharing.
- Require mipmapped Basis Universal KTX2 for in-world textures, including embedded
  images. Validate with pinned Khronos `ktx validate`, using glTF compatibility checks for
  glTF textures. Max 2048 px per side by default. Allow up to 4096 px only for explicitly
  listed hero/environment textures with owner approval and a memory budget. Allow
  PNG/WebP for UI art. Keep audio in OGG/MP3 and verify that file headers match extensions.
- Keep a structured asset inventory keyed by path or an explicit asset family. Require a
  matching `CREDITS.md` entry for third-party assets with title, creator, source, license
  and modifications. Allow original work, CC0, and CC BY. Track original assets as such.
  CI catches missing and orphan entries and disallowed identifiers. The owner verifies
  provenance and license terms when assets arrive or their source changes.
- Validate the full inventory and size rules on every build. Run full binary validation
  at P0. If that exceeds the package budget, validate changed binaries and affected
  dependents on PRs, and keep a full pass on `main`. Include fixtures in applicable
  format, size, and provenance checks. [glTF Validator](https://github.com/KhronosGroup/glTF-Validator)
  · [KTX validation](https://github.khronos.org/KTX-Software/ktxtools/ktx_validate.html)

### Playwright smoke and visual comparisons

- Pin the Playwright package, matching Chromium revision, Linux image digest, fonts,
  and ANGLE backend. Launch headless Chromium with `--use-gl=angle --use-angle=swiftshader`,
  assert WebGL2 and verify the renderer identifies SwiftShader. Keep the browser sandbox
  and job isolated. Load only the locally served app. [Chromium SwiftShader flags](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/docs/gpu/swiftshader.md)
- Boot the normal built entry. Wait for the app to signal that startup assets compiled
  and the first controllable frame was drawn. Decode a screenshot of the canvas and
  check a small expected visible region for a minimum count of lit pixels and some
  luminance variation. Add lit reference geometry to the P0 scene. Fail on uncaught
  page exceptions, console errors, WebGL context loss, missing resources, or failure
  to become ready within 30 s. Exercise the friendly no-WebGL2 fallback separately.
- Use a test-only Vite entry for deterministic screenshots and counters, using the same
  renderer and asset pipeline. Keep that entry and its controls out of deployed `dist`.
  Fix seed, route position, time of day, simulation tick count, camera, quality tier,
  viewport (1280×720), DPR (1), resolution scale, and locale. Wait for scene assets,
  shader warmup, and fonts. Freeze inputs and simulation before screenshot capture.
  Use fixed steps for snow and animations, and freeze temporal effects or disable
  them in the fixture when they cannot be made repeatable.
- Commit small PNG baselines under `tests/visual/baselines/` for the pinned Linux Chromium
  project. Start with one P0 scene, add the birch window in P1, then add the PRD's cozy
  cabin at 22:45, dining car at 18:30, and dawn corridor at 05:10 as available. Keep
  permanent capture names tied to the scene.
- Require consistent results on two clean runs before making a new scene blocking.
  Start with Playwright pixel threshold `0.1` and `maxDiffPixelRatio: 0.001`. Diagnose
  systematic differences before tuning, and scope any proven tolerance to the affected
  capture. A screenshot mismatch fails the gate on the first run. Retry an infrastructure
  failure only after identifying it.
- For an intentional visual change, run the snapshot update command in the same pinned
  container using Playwright's `--update-snapshots`, commit the affected PNGs, and attach
  before/after or diff images in the PR. The owner reviews images and any test or tolerance
  change. Upgrade the browser/container in a dedicated PR with any regenerated baselines.
  [Playwright visual comparison guidance](https://playwright.dev/docs/test-snapshots)

### Performance smoke

- On a fixed Medium interior route sample, warm up first and measure a fixed window of
  frames. Sum draw calls and triangles across scene and shadow passes; report post-processing passes separately.
  Gate at **300 scene draw calls** (post-processing passes reported separately, not counted) and **1.5 million triangles** at the worst sampled frame.
  Estimate texture/geometry/render-target allocations and report against **512 MB**.
  Label the estimate explicitly. [three.js renderer counters](https://threejs.org/docs/pages/WebGLRenderer.html)
- Log time to first frame, CPU-side frame timings, and asset/chunk allocation counts.
  Check that repeated traversal over the fixture keeps the loaded chunk pool within its
  configured cap. Treat timing from shared CPU runners and SwiftShader as diagnostic.
- From P1, review rendering-heavy changes on an M1 MacBook Air or Intel Iris Xe at
  1080p Medium. Before MVP release, measure p95 frame time **<16.7 ms**, streaming
  hitches **≤50 ms**, and check memory over a **60-minute** idle run. Check Chrome,
  Firefox and Safari manually for release, covering the PRD's supported versions.

## 4. PR previews: none (owner decision)

There are **no hosted per-PR previews**. GitHub Pages serves only production from `main`.

- **Agents** test locally (dev server + headless browser screenshots) and in CI (Playwright boot,
  visual and perf checks). Neither needs a hosted preview.
- **The owner** reviews visual changes by checking out the branch (`gh pr checkout <n> && pnpm i && pnpm dev`)
  and from the screenshots and clips every visual PR must include (AGENTS.md).
- If that becomes tedious, add previews later: Cloudflare Pages or Netlify Git integration is a
  zero-workflow-code option for a repo without secrets. That's a P4+ decision, not a dependency.

## 5. Binary assets and Git

Use **plain Git** for optimized runtime GLB/glTF, KTX2, and audio from P0. Keep source
authoring exports and alternate takes out of the runtime repository. Shallow CI checkout
avoids historical binary versions, while full developer clones still grow with each revision.
Avoid repeated large binary re-exports and split assets by scene and streaming boundary.

- Target **≤5 MiB** per runtime blob. Flag larger additions for review. Cap every added
  tracked blob and every file in `dist` at **20 MiB**. Re-encode or split larger files.
  These are project limits. GitHub warns over 50 MiB and blocks over 100 MiB.
- Warn at **250 MiB** of checked-out runtime assets and **500 MiB** in packed Git history.
  Check packed size periodically with a full clone and cap deployed output at **500 MiB**.
  GitHub Pages has a 1 GB site cap and soft bandwidth limit of 100 GB/month. Watch aggregate
  transfer as the audience and route grow. [GitHub large files](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github)
  · [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)
- LFS reduces historical payload for fresh clones but has separate storage and download
  quotas, including downloads by Actions. Pages has no LFS serving support. An Actions build
  using LFS would have to hydrate the bytes before packaging static output, with explicit
  pointer detection and quota monitoring. Revisit only if optimized blobs still drive
  clone size past the warning. [Git LFS on GitHub](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-git-large-file-storage)
  · [LFS billing](https://docs.github.com/en/billing/concepts/product-billing/git-lfs)

## 6. Continuous deployment, releases, and rollback

- Select **GitHub Actions** as the Pages source. On push to `main`, rerun the same
  gates on that commit and deploy its exact tested `dist`. Use `actions/configure-pages`,
  `actions/upload-pages-artifact`, then `actions/deploy-pages` in a `github-pages`
  environment restricted to `main`. Grant `pages: write` and `id-token: write` only
  to the deploy job. Use a relative Vite base (`./`) and verify built asset URLs under
  `/night-train-east/` and at `/`. Keep asset lookup and navigation base-aware.
  [Custom Pages workflow](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
  · [Vite relative base](https://vite.dev/guide/build.html#relative-base)
- Serialize the production workflow in a Pages concurrency group from the push event and
  let active runs finish. Just before deployment, skip a superseded commit if `main` advanced.
  After deploy, probe the entry and a hashed asset on the production URL. Compare to the
  expected build identifier with a bounded retry for propagation. Surface failures and the
  live URL with commit SHA in Actions. Retain successful gated production artifacts for 30 days.
- A merge is a deploy. For milestone releases, the owner creates annotated SemVer tags on
  verified deployed commits, starting with `v0.1.0` for One Night, and publishes GitHub
  Releases with generated PR notes edited into player-facing changes and known issues.
  GitHub Releases are the changelog. Keep an independent save schema version. Start without
  Changesets or release-please. [Generated GitHub release notes](https://docs.github.com/en/repositories/releasing-projects-on-github/automatically-generated-release-notes)
- Roll back with a revert PR for the offending squash commit. If several commits are involved,
  revert the smallest set that restores known-good behavior. Link the last healthy deployment
  and record any save-state compatibility risk. The revert passes the same rules and deploys
  from `main`. Verify the live build ID, a cold boot, and save/resume when relevant. A failed
  predeploy gate should leave the previous site serving. Never rewrite `main` or move a tag.

## 7. AI review

Leave automated AI review off until after the MVP (v0.2). Later, try opt-in Claude review for complex renderer,
save-state, and CI changes using an owner-applied label or owner-only command. Run at most once
per head SHA per request. Set a small diff/token limit, a five-minute timeout, and a monthly
spend cap. Skip binaries, generated files and dependency-only updates. Send only the permitted
diff to the selected provider. Run trusted review code, treat diff text as data, disable shell
and other execution tools, and give the reviewer comment-only write access and no deploy secrets.
Post one concise advisory review. The owner still makes the acceptance decision.

## 8. Templates, dependencies, and permissions

- **PR template.** Ask for problem and scope, issue/PRD link, tests run and reproduction
  steps, reviewed SHA, rendering before/after evidence, startup/perf deltas when
  relevant, asset provenance, and any save migration or rollback considerations. Include the
  checklist below. Keep optional fields easy to mark N/A.
- **Issue forms.** Game bug (steps, expected/actual, browser/GPU, save state), feature
  (player outcome and PRD link), art/audio (scene, format, budget, license), and performance
  (route, quality, hardware and trace). Route security reports to GitHub private vulnerability
  reporting when available, with an owner security contact as the fallback.
- **Dependabot.** Enable alerts and security updates. Schedule weekly `npm` (pnpm) and
  `github-actions` updates at the root. Group routine dev minor/patch bumps and Actions
  updates within each ecosystem, cap routine open PRs at three per ecosystem, and review
  majors separately. Keep three.js and Playwright/browser image updates in focused PRs.
  Review new action SHAs and release sources. Require normal checks and owner review.
  [Dependabot ecosystem support](https://docs.github.com/en/code-security/reference/supply-chain-security/supported-ecosystems-and-repositories)
- Pin all external Actions to full upstream commit SHAs with a human-readable version
  comment, and pin OCI images by digest. Default workflows to `contents: read` or
  `permissions: {}`. Use narrow job permissions for artifact reads, PR comments, and Pages
  deploy. Disable checkout credential persistence when possible. Use GitHub-hosted runners
  for PR code and keep deployment credentials out of PR workflows, caches, artifacts, logs,
  and Vite client variables. Minimize install scripts with pnpm's explicit build allowlist.
  Pass untrusted event strings as data. [GitHub Actions secure use](https://docs.github.com/en/actions/reference/security/secure-use)

## 9. Definition of Done for a PR

- [ ] One focused change with a Conventional Commit title and a clear acceptance test.
- [ ] Branch is current with `main`, and all required checks pass for the final revision.
- [ ] Visual changes include screenshots or a short clip; the owner has run the branch locally if needed.
- [ ] Test changes and any screenshot diffs explain the intended behavior.
- [ ] Startup and rendering budgets pass, and relevant hardware results are recorded.
- [ ] Asset credits, save compatibility, and rollback implications are addressed if applicable.
- [ ] Review threads are resolved, and the owner has approved or logged the solo-owner exception.
- [ ] Owner squash-merges. The Pages deployment for the resulting commit passes its live probe.

## 10. Rollout (revised after cross-review: start small)

Everything above is the **target** pipeline. Build it incrementally. Each step is switched on when the
thing it protects actually exists, never before.

| Phase | Turn on |
|-------|---------|
| **P0** | One workflow: install (pnpm cache) → `tsc --noEmit` → `biome ci` (incl. `noRestrictedImports` folder rules) → `vitest run` → `vite build` → a ~30-line byte-size script (initial JS + initial assets ≤ budget) → upload `dist` as an artifact. `ci / required` aggregator. On `main`: deploy to Pages. One ruleset: PR required, `ci / required` green, linear history, no force-push. PR template, CODEOWNERS, Dependabot (weekly, grouped). Pin actions by SHA. |
| **P1** | Playwright **boot smoke** only (WebGL2 via SwiftShader, non-black frame, no console errors). |
| **P2** | glTF validator + KTX2 checks + `CREDITS.md` check, switched on with the **first real GLB/KTX2**. Perf counters in the browser job (scene draws, triangles, chunk-pool cap). First physical-iGPU capture of the heavy frame. |
| **P3** | Deterministic visual baselines for the 3 third-person camera bookmarks once the scenes stop churning daily. Interaction + save/resume e2e. Second (review) ruleset with the owner PR-only bypass, if agent PR volume makes it worthwhile. |
| **P4 / release** | Revisit hosted previews only if local review proved tedious (§4). Cross-browser, cold-load, GPU and 60-min idle acceptance. Tag `v0.1.0`. |
| **v0.2+** | Opt-in AI review (§7). |
