# Working on Shot Selection

Shot Selection is a browser pool-training game with a 100-level course, a scenario sandbox, and a stroke lab. It uses React, TypeScript, Vite, React Three Fiber/three.js, and cannon-es. The app runs locally without a backend; session progress is stored in the browser.

## Read first

- [Architecture](docs/architecture.md): application flow, engine boundaries, rendering, persistence, and where to make changes.
- [Level authoring](docs/level-authoring.md): creating and fine-tuning JSON levels, sandbox/lab workflows, shot controls, validation, and current limitations.
- [README](README.md): local setup, gameplay, and browser-test prerequisites.

Read the relevant guide before changing its area. Keep these guides aligned with changes to behavior, configuration, or workflows.

## Repository map

- `src/App.tsx`: course/sandbox lifecycle and application state.
- `src/levels/*.json`: authoritative per-level configuration; `index.ts` orders the course and `level.schema.json` defines the format.
- `src/engine/`: preparation, simulation, objectives, analysis, teaching comparisons, and worker requests; unit tests live beside the modules.
- `src/components/`: gameplay UI, sandbox/lab editors, 3D table and SVG fallback, and comparison displays.
- `src/lib/`: session/highscore persistence, feedback, reports, and sound.
- `e2e/`: Playwright browser workflows.

## Important behavior

- Edit level configuration in JSON. New fields also need schema validation, types, and an engine consumer; the schema rejects unknown fields.
- Prepared choices and results come from simulation. Keep scoring and teaching explanations tied to the actual plans and evidence. Rendering must use the same table geometry and outcomes.
- `shotGeneration` and `lessonTuning` influence generated candidates. `authoredShots` supplies exact choices, with exactly three per offered ball for course play.
- Authored choices currently reject any `curriculum.learning` comparison. Do not remove the comparison merely to bypass this restriction when preserving an existing lesson. See the authoring guide for supported workflows.
- JSON import preserves saved layouts and controls. Export downloads a definition; it does not write repository files. Sandbox/lab drafts need export to survive leaving the app.
- Keep seeded simulation reproducible. Check relevant orientations and player precision when changing physics, options, or objectives.

## Commands and checks

Run commands from the repository root:

```sh
npm run dev
npm run typecheck
npm test -- src/engine/level-config.test.ts
npm run test:e2e -- e2e/level-authoring.spec.ts
npm run build
```

The dev server defaults to port 5178. Use the affected unit tests while iterating; run `npm test` for course/engine regression coverage. The full physics suite takes several minutes. Use relevant Playwright specs for UI workflows and `npm run build` for production validation. Avoid source edits during browser tests because Vite reloads can interrupt them. `npm run doctor` is available for React diagnostics.

For documentation-only edits, check relative links, examples, and `git diff --check`; no application test rerun is needed. Follow the existing style in the files you change and keep unrelated work intact.
