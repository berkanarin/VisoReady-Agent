# Runtime workflow

The CLI does not call a model API. The host coding agent does source analysis, topic selection and narration. The runtime provides validated capture and compilation. Resolve its path from `runtime.json` next to SKILL.md.

## Inputs

- Existing URL: inspect with available browser tools; propose topics before broad generation.
- Local source: `inspect <absolute-folder>` reads inventory and package metadata without running scripts.
- Git source: `clone <credential-free-https-url> --out <new-folder>` uses Git, does not install dependencies or initialize submodules. Private authentication must be supplied through the user's authorized Git environment, never embedded into the URL.
- Native app/Office add-in: propose topics from source; identify an actual capture route. Playwright cannot operate a native host. Source-rendered panel previews must be labeled and do not validate native actions.
- PNG/JPEG files: relative file paths in a manifest, normalized by the compiler without re-encoding the original image. Keep files under the manifest directory. Video/Mimik adapters are deferred.

## Source-backed proposal

Catalog format: `version:1`, `project`, absolute `sourceDirectory`, `guides`.
Each guide: `id`, `title`, `goal`, `captureMode` (`browser`, `native`, `source-preview`), `prerequisites` string array, `outline` string array, `evidence:[{file:"relative/source.ts",line:42}]`.
`plan catalog.json --out output/plan-01` validates that references exist, but the agent must check that the cited code actually supports the claim.
Present titles and wait. `select output/plan-01/plan.json --ids guide-one,guide-two --out output/selection-01` records scope only.

## Capture recipe

Use the runtime's `examples/demo.recipe.json` as a concrete template, not guessed selectors for another app.
Top level: `version:1`, `title`, `language` (`tr` or `en`), `startUrl`, exact `allowedOrigins`, `viewport:{width,height}`, optional `masks`, `steps`.
Each step: unique `key`, `title`, optional `actions`, optional `ready` locator, `annotations`.
Optional `settleMs` (integer 0-10000, default 0) waits after readiness/assertions and moving the pointer away, before capture. Use it for canvas maps or delayed visual rendering; it does not prove that tiles are complete. Inspect every captured screen, preserve visible third-party attribution and verify the requested UI language in a clean session before sharing.
Optional `assertions: [{target, containsText}]` waits up to 15 seconds for each unique visible target to contain the expected text after the actions. It fails closed without replaying actions and records only `evidence.assertionsPassed`. This is UI evidence, not a database guarantee. Prefer a persistent result row over a transient toast.
Each annotation: `target`, `text`, optional `label`, `trigger` (`auto`, `click`, `hover`, `goto`), optional `goto` step key.
For newly authored explanatory annotations, supply a concise `label` and `showLabel: true`; the label becomes the caption heading and frame tag. The body should explain the action without repeating the heading. Review both title placements on desktop/mobile. Schema defaults remain unchanged for compatibility: omitting `showLabel` does not enable headings in older recipes.
Targets: CSS string, `{role:"button",name:"Create"}`, `{label:"Name"}` or `{testId:"create"}`. A target must resolve uniquely. Use DOM boxes, not model-invented coordinates.
Actions: `goto` with URL; `click`, `scroll`, `wait` with target; `fill` with value; `fillSecret` with environment variable name; `press` with key; `select` with value; `check` with checked boolean. `wait` state defaults visible. No arbitrary JavaScript actions.

Capture records the state AFTER a step's actions. To explain a button, capture it first, then click it in the NEXT step. It never clicks annotations automatically.

`capture recipe.json --out output/capture-01 --allow-actions` produces clean PNGs and a manifest. `--auth` accepts a private Playwright storage-state file; `--headed` shows the browser. There is no automatic sign-in helper; use the available browser tooling for authorized login.

For local static/Vite/Next projects: `pnpm agent run-source <source> --recipe recipe.json --out output/capture-01 --port 4173 --allow-run --allow-actions`. Use `{{BASE_URL}}` in the recipe URL/origins. Run through pnpm so its executable is known. This starts no installation, requires installed dependencies, closes its own server, and refuses an occupied port. A non-dev script can be selected with `--script`. Unsupported frameworks require reviewed manual startup.

## Manifest and output

`version:1`, `title`, `language`, `steps:[{key,title,image:"01.png",annotations:[{px:[x,y,width,height],text,label,trigger,goto}]}]`.
Capture adds evidence with image hash, source URL stripped of query/hash, timestamp, viewport and scroll. Hashes detect later modification, not forged origins. Provenance paths and screenshot pixels may still contain sensitive information; review before sharing.

`validate manifest.json` checks image decoding, byte/pixel budgets, bounds, IDs, hashes and navigation targets.
`build manifest.json --out output/flow-01` creates `project.ohig.json`, `review.html` and `evidence.json`.
`check output/flow-01/project.ohig.json --editor <trusted-VisoReady.html> --out output/check-01` imports the real editor and creates a preview player plus screenshots and a verification report. It runs trusted editor JavaScript locally. Do not pass an untrusted file as the editor.
It also writes `quality.json` and `QUALITY.md`, audits supported annotations at 1440/390 widths and retains up to 24 finding screenshots. Check both `checkedStates/expectedStates` and status. Warnings are review heuristics, not failures or proof of illegibility. No OCR, automatic layout repair, mobile reframing or preservation-aware recapture is implemented. Never mark an unvisited state as verified.

Version 0.1 supports annotations with auto/click/hover/goto and optional `style` (`frame`, `both`, `beacon`, `none`), `spot` (`auto`, `square`, `rounded`, `pill`, `circle`), `backdrop` and `showLabel`. Optional `cameraPx: [x,y,width,height]` sets a non-destructive camera focus within the original screenshot bounds. For dense UI, prefer `frame`, `square`, `backdrop: false` and short caption headings; do not cover small controls with beacons or long frame labels. Native captures from an authorized external tool can carry `kind: native`, `application` and `coordinateSource: visual` evidence. The runtime does not control native applications itself. Type/select exercises and audio generation are not implemented; they remain editable in VisoReady.
