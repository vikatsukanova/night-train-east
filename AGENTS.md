# AGENTS.md — working agreement for AI agents (and humans)

This repo is built by one human owner plus several AI coding agents (Claude, Codex, Gemini, …).
Every agent reads this file before starting work. `CLAUDE.md` points here.

## Read first

1. `docs/PRD.md`: what we're building and what's in or out of scope.
2. `docs/ARCHITECTURE.md`: module map and dependency rules (§4.1).
3. `docs/RENDERING.md` for anything visual, and `docs/CICD.md` for anything in `.github/` or tooling.

## Ground rules

- **One task → one branch → one PR.** Branch names: `<type>/<short-slug>`, e.g. `feat/birch-biome`.
  Never push to `main`.
- **Stay in your lane.** A task names the folders it owns (e.g. `src/world/scenery/**`). Touching
  code outside them needs a sentence in the PR description saying why. Cross-cutting changes
  (`core/events.ts`, `Game.ts`, configs) get their own small PR.
- **Respect the dependency rules** in ARCHITECTURE §4.1. Don't import between feature folders.
- **No new runtime dependency** without a line in the PR explaining why and its gzipped size.
  Dev dependencies are fine with a short reason.
- **Determinism**: scenery and anything time-based must derive from `rideT` and a seed. Never use
  `Math.random()` or `Date.now()` in gameplay or render code (use `core/rng.ts` and `core/clock.ts`).
- **Assets**: every new asset gets a license entry in `CREDITS.md` (CC0, CC-BY or original only).
  Run the asset pipeline. Don't commit unoptimised exports to `public/assets/`.
- **Before opening a PR**, run `pnpm verify` (typecheck + lint + unit + build) locally and make
  sure it passes. Include screenshots or a short clip for any visual change.
- **Don't edit tests to make them pass** unless the behaviour change is intended and stated in the PR.
  Updating visual baselines needs before/after images in the PR and owner review (CICD §3).
- **Ask, don't guess**, on product questions (see PRD §7). Put the question in the PR or issue,
  pick the documented default, and keep going.

## Suggested model routing (owner can override)

| Work type | Good fit |
|-----------|----------|
| Architecture, cross-module refactors, reviews | Claude Opus |
| Well-scoped feature implementation, tests, tooling, CI | Codex (GPT) or Claude Sonnet |
| Shaders, visual tuning, reading concept art, art-direction checks | Gemini |
| Dialogue writing (Ink, v0.2), NPC personalities | Claude |
| Second-opinion PR review | A different model from the one that wrote the PR |

## PR description must include

- What and why (link to the issue or milestone), and the folders touched.
- How it was verified (commands run, `?moment=` URLs checked).
- A screenshot or clip if anything visual changed, plus the perf impact if render or world code changed
  (draw calls and frame time from the dev overlay).
