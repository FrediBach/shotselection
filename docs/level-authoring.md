# Creating and fine-tuning levels

This guide covers the JSON format, sandbox and lab workflow, shot options, and checks for changing the course. For the runtime and repository structure, see [Architecture](architecture.md).

## Where levels live

The course reads one JSON file per level from [src/levels](../src/levels/), ordered by [index.ts](../src/levels/index.ts). Start with an existing lesson such as [001-your-first-pot.json](../src/levels/001-your-first-pot.json). The [JSON Schema](../src/levels/level.schema.json) defines supported fields and limits; [level-config.ts](../src/engine/level-config.ts) adds reference and geometry checks.

Level files contain layouts, instructional text, objectives, conditions, scoring, and shot-generation settings. Physics and teaching-comparison algorithms remain in TypeScript. Prepared paths, ensemble results, rankings, and comparison evidence are computed from the saved inputs and are not serialized.

The current course has 100 levels in ten chapters. All bundled levels currently generate their choices; none includes `scenario.authoredShots`. The engine supports that field for eligible exercises, with the restrictions below.

## Fine-tune an existing lesson

1. Run `npm run dev`, select a player, and start **Sandbox** in **Scenario mode**.
2. **Import JSON** from the level file to use its exact saved layout. Selecting a lesson from the dropdown in random placement mode starts a sandbox layout search, which can change ball positions.
3. Use **Place the balls myself** to move balls, or **Edit level JSON** to change text, scoring, objectives, conditions, and generation settings. JSON coordinates are metres; the position editor displays centimetres.
4. Press **Test layout** and wait for **Ready to play**. Generated choices must satisfy the lesson's preparation requirements. A failed search leaves the layout editable.
5. **Play this layout** and inspect the result, teaching comparison, and replays. Check that the lesson still demonstrates what its briefing claims. Keep the seed and player precision fixed when comparing edits.
6. Return through **Change setup**, then **Export JSON** to download the current definition. **Another layout** can randomize the setup, so use **Change setup** to retain the played table. Exports do not overwrite repository files. Replace the corresponding file in `src/levels/`, retain its identity and course metadata, then run the relevant checks below.

Importing is exact: it does not automatically mirror or refit saved strokes. **Generate another layout** / **Random starting layout** requests new positions. Switching between scenario and lab mode preserves each draft during that sandbox visit; export before leaving or reloading to keep your work.

## Document structure

| Field | Meaning |
| --- | --- |
| `$schema` | Optional editor hint; bundled files use `./level.schema.json`. Runtime validation does not depend on that path. |
| `schemaVersion` | Required format version, currently `1`. |
| `id` | Stable document ID, such as `level-001`. Retain it when updating a course level. |
| `kind` | `level` checks physical placement on import; `draft` permits unfinished placement. Neither proves that a playable round exists. |
| `variation` | Required `mirrorX` and `mirrorY` booleans controlling permitted course reflections. |
| `scenario` | Required `level`, `seed`, `title`, `description`, and `balls`, plus the optional settings below. |
| `scenario.curriculum` | Chapter/lesson metadata, briefing, takeaway, and optional specialized `learning` comparison. |
| `scenario.scoring` | Explicit finish-scoring switch and tolerance. Prefer explicit settings over legacy level-number defaults. |
| `scenario.objective` | Position goal: first ball, reserved next ball, radius, cut-angle limit, and optional landing target/shape. |
| `scenario.bank`, `plant`, `trick`, `finalBall` | Other task requirements. These are not freely combinable; the validator checks supported combinations. |
| `scenario.defense`, `plannedMovement` | Additional requirements for supported position exercises. |
| `scenario.conditions` | Cloth, patches, directional drift, cushions, cue defects, and dirt. |
| `scenario.shotGeneration`, `lessonTuning` | Candidate-search and lesson-specific controls for generated choices. |
| `scenario.authoredShots` | Optional exact strokes that replace generated choices. |
| `lab` | Optional trial count, player talents, and per-stroke auto-adapt/lock settings. These reopen the lab experiment; they do not override the course player's talents or trial count. |

Unknown fields are rejected. There is no arbitrary scripting in JSON. Add a new supported parameter to the schema, types, consuming engine code, and relevant tests together. Runtime `scenario.authoring` tracks import provenance and is not a JSON field.

## Coordinates and units

The playing surface is 2.54 m by 1.27 m. In the top-down view, `(0, 0)` is the top-left corner, `x` increases rightward, and `y` downward. Ball centres must clear cushions and pockets and must not overlap. Ball `0` is the cue ball; object-ball IDs are `1`–`15`.

| Pocket ID | Position |
| --- | --- |
| `0` | Top left |
| `1` | Top middle |
| `2` | Top right |
| `3` | Bottom right |
| `4` | Bottom middle |
| `5` | Bottom left |

| Value | Unit/convention |
| --- | --- |
| Positions, radii, finish separation | Metres |
| Stroke `speed` | Metres/second, `0.1`–`4` for authored strokes |
| `topSpin` | Fraction of natural rolling spin, `-2`–`2`; negative is draw, positive is follow |
| `sideSpin` | Radians/second, `-100`–`100` for authored strokes |
| `aimOffset` | Degrees from the geometric direct-pot aim, positive clockwise in the table view; `-180`–`180` |
| Objective `maxCutAngle` | Degrees |
| Ellipse `angle`, cue `angleBias`, bank angle corrections | Radians |

The geometric aim depends on the current ball positions and pocket. Moving balls while retaining the same `aimOffset` does not retain the same world-space stroke angle. See [lab.ts](../src/engine/lab.ts) and [constants.ts](../src/engine/constants.ts).

## Influence generated shot options

Leave `scenario.authoredShots` absent to generate choices. This example shows fields to merge into `scenario`:

```json
{
  "shotGeneration": {
    "speedMultipliers": [0.95, 1.2, 1.5, 1.85, 2.3],
    "topSpins": [-1.1, 0, 1.05]
  },
  "lessonTuning": {
    "minFinishSeparation": 0.12,
    "minSpeedDifference": 0.12,
    "minSpinDifference": 0.35,
    "maxCandidateSpeed": 3.6
  }
}
```

`speedMultipliers` scale the route's calculated base speed; they are not absolute speeds or one entry per A/B/C choice. The engine samples speed/spin combinations, calibrates where needed, simulates them, and selects three that meet feasibility, distinctness, and teaching requirements. Generated options are ordered by speed, then spin, rather than success ranking.

The three distinctness thresholds apply together to each pair. For example, restricting `topSpins` to `[0]` while keeping `minSpinDifference: 0.35` cannot provide three distinct choices in the ordinary search. Reducing a threshold may permit a set, but does not guarantee valid geometry or a useful teaching contrast.

Useful additional controls in `lessonTuning` include:

| Controls | Used for |
| --- | --- |
| `expandedSpeeds`, `expandedTopSpins` | Extra direct-shot candidates in the expanded manual-layout search; speeds here are absolute m/s. |
| `bankSpeeds`, `bankTopSpins`, `bankAngleCorrections` | Cushion-first shot search. |
| `plantSpeedMultipliers`, `plantTopSpins` | Combination-shot search. |
| `trickSpeeds`, `trickTopSpins` | Trick-shot search. |
| `assignmentSpeedMultiplier`, `assignmentAngleOffset` | The assignment-failure demonstration's stroke adjustment. |
| Other named lesson parameters | Specific comparisons, recovery searches, and condition probes; consult the schema and [lesson-tuning.ts](../src/engine/lesson-tuning.ts). |

`curriculum.englishPractice` supplies sidespin magnitude for generated English exercises. Specialized searches use their own tuning fields; changing the direct-shot grid alone does not control every lesson. Expanded searches can add candidates beyond the initial grid. Merge tuning edits into the existing object to retain the other authored settings.

## Specify exact options with authoredShots

For supported exercises, `scenario.authoredShots` replaces automatic selection entirely. The lab writes this field on export. Its presence is meaningful: remove the field to restore generation rather than setting it to an empty array.

This is an example field to merge into `scenario`, assuming ball `1` exists. Tune the values for your layout; the example does not promise successful pots:

```json
{
  "authoredShots": [
    {
      "id": "soft-draw", "label": "Soft draw",
      "settings": { "ballId": 1, "pocketId": 1, "speed": 1.1, "topSpin": -0.7, "sideSpin": 0, "aimOffset": 0 }
    },
    {
      "id": "center", "label": "Center ball",
      "settings": { "ballId": 1, "pocketId": 1, "speed": 1.4, "topSpin": 0, "sideSpin": 0, "aimOffset": 0 }
    },
    {
      "id": "firm-follow", "label": "Firm follow",
      "settings": { "ballId": 1, "pocketId": 1, "speed": 1.7, "topSpin": 0.7, "sideSpin": 0, "aimOffset": 0 }
    }
  ]
}
```

Each stroke needs a unique `id`, a `label`, and all six settings. `settings.ballId` is the first-contact ball; optional `potBallId` identifies a different ball to pot in a combination. Optional `target: { "x": ..., "y": ... }` preserves the stroke's finish reference. Without it, preparation uses the simulated nominal cue endpoint. A position objective's common `objective.target` takes precedence for scoring.

Editing speed, spin, or aim in the lab retains an explicit stroke `target`. Adjust that target intentionally, or remove it in **Edit level JSON** to derive the new nominal finish during preparation. Changing the ball or pocket clears both the stroke's `target` and `potBallId`; a saved combination becomes a direct stroke unless you author its combination metadata again.

Course play needs exactly three strokes per offered first-contact ball. Their array order within that ball becomes A/B/C; labels remain attached to the stroke. Balls without authored groups do not get automatically generated options. The format permits up to 16 strokes, so at most five complete groups can be played. Draft experiments may use other counts.

Preparation preserves saved controls, including deliberately poor or unsuccessful strokes. It does not refit or discard misses to create a playable-looking set. A successful **Test layout** for authored choices confirms the structure can be played, not that any option wins.

### Current teaching-comparison limitation

Any `scenario.curriculum.learning` currently prevents authored-shot course preparation. The specialized comparisons require derived evidence that the authored path does not yet build. This affects 88 of the 100 current bundled levels. Levels **1, 2, 3, 5, 6, 8, 9, 10, 11, 16, 21, and 32** currently omit `learning`; other objective checks still apply.

Removing `learning` changes the lesson by removing its specialized comparison. Use that only when intentionally creating an independent exercise. For fine-tuning an existing specialized lesson, keep generated choices and adjust its configuration, or extend preparation to derive and validate the required teaching evidence from authored strokes. JSON alone does not implement that extension. The authoritative restriction is in `prepareAuthoredRound` in [preparation.ts](../src/engine/preparation.ts).

Authored position exercises require an explicit `objective.target`. Position, bank, trick, and final-ball objectives require the authored group for their designated first ball only. Plant decisions require groups for the plant's first ball and a free ball; the plant's target ball is not the free-ball alternative.

### Lab workflow for exact choices

1. Import a supported lesson in scenario mode and **Test layout** first. Successful preparation supplies generated choices and any derived landing target.
2. Click **Develop in lab** to copy those choices and the lesson metadata. Opening an unprepared layout supplies starter strokes instead.
3. Adjust strokes and run ensembles. Disable **Auto-adapt**, or lock the relevant fields, when preserving exact values. Imports do not trigger fitting; later edits with assistance enabled can.
4. Reduce the final set to exactly three strokes per offered ball. More variants can be kept in a separate draft. Indirect combination shots can be edited and analyzed, but automatic fitting currently supports direct shots only.
5. Choose **Use in scenario**, **Test layout**, and **Play this layout**. Lab success checks the nominated pot, correct first contact, no scratch, and a settled table; it does not validate the full course position, next-ball, or trick objective.
6. Return through **Change setup**, export the tested definition, and replace the intended course JSON. Preserve its level number and curriculum metadata; run the checks below.

Saved lab precision and trial counts make experiments reproducible. Course and scenario play use the selected player's talents and their own analysis settings, so verify the intended player profile there as well.

## Scoring, targets, and orientation

Set `scenario.scoring.position` explicitly. `false` makes an ordinary exercise pot-only. `true` scores the finish with `scoring.tolerance` unless a position objective supplies its own `radius`. A position objective cannot disable finish scoring; a final-ball objective cannot enable it. Removing `finalBall` alone does not change an explicit `scoring.position: false`.

Generated position lessons can derive `objective.target` during preparation. Importing a JSON file containing that target makes it an intentional fixed zone. Remove `objective.target` and any derived `objective.regions` before testing if you want the generator to choose a fresh zone for a changed layout. Authored strokes always need the target supplied for a position exercise. Adjust instructional text when changing the goal.

Course generation applies seeded reflections only where `variation` allows them. It also reflects pockets, conditions, targets, and stroke aim/English signs. Sandbox imports reopen the exact saved orientation. Generated layouts export with reflections disabled to preserve the visible setup; explicitly imported variation settings are retained. Moving balls disables reflections for the edited layout. Review these flags before replacing a reusable course file.

## Create a new exercise or save partial work

Start in Lab mode for a neutral experiment, or copy a similar level to retain its metadata and objectives. Use `kind: "draft"` for unfinished work. Drafts still need valid types, ranges, IDs, and references, but can retain overlapping or unfinished placements. The UI automatically exports invalid physical placements as drafts. Playing or running simulations still requires valid geometry.

**Use in scenario** from a neutral draft without curriculum merges its balls, strokes, seed, and lab settings into the selected scenario. Draft conditions replace existing conditions when supplied; omitted conditions leave the selected lesson's conditions intact. The selected lesson's other metadata and objectives remain. This can encounter the authored teaching-comparison restriction. A complete lesson document carries its own metadata through the handoff.

To restore automatic choices from a lab export, remove `scenario.authoredShots` and any `lab.assistance` entries that reference those strokes. For a clean course definition, the optional top-level `lab` block can be omitted entirely.

For a new exercise in the existing course, replace an intended slot and retain its `id`, `scenario.level`, and chapter/lesson indices. Mark a completed course definition as `kind: "level"` and validate it. Merely adding another JSON file does not add a course slot: imports/order in [src/levels/index.ts](../src/levels/index.ts), chapter sizing in [course.ts](../src/engine/course.ts), the schema's level limit, progress/save migrations, and curriculum tests must be updated together for a larger course.

## Validate changes

Run commands from the repository root. Start with the format/runtime tests and the affected lesson's engine test:

```sh
npm run typecheck
npm test -- src/engine/level-config.test.ts src/engine/authoring-runtime.test.ts
npm test -- src/engine/scenarios.test.ts -t 'prepares authored level 21,'
```

Replace `21` with the edited level. That course test exercises four seeds, checking the permitted orientations and lesson requirements. Specialized modules also have focused tests such as `src/engine/plant-quality.test.ts`; use the corresponding test for the comparison you changed.

For course or engine changes, run the full unit suite and production build. For authoring UI changes, run the relevant browser flows as well:

```sh
npm test
npm run build
npm run test:e2e -- e2e/level-authoring.spec.ts e2e/sandbox.spec.ts e2e/lab.spec.ts e2e/lab-auto.spec.ts
```

The full physics suite takes several minutes. Playwright starts or reuses the local Vite server; avoid source edits while a browser run is active. Browser setup is documented in the [README](../README.md#run-locally). Documentation-only changes need link/example and whitespace checks, not physics or browser reruns.

Existing curriculum tests assert the teaching behavior, not just schema validity. If you intentionally change that behavior, update the affected expectations with a clear explanation; a valid JSON file alone does not demonstrate a useful lesson.

| Problem | What to check |
| --- | --- |
| Unknown field, invalid range, or missing ball reference | Follow the import error's field path and the schema. Reconcile IDs after removing balls or strokes. |
| No feasible three-finish layout | Geometry, candidate grids, distinctness thresholds, and the lesson's contrast requirements. A bounded search failure is not proof that no physical shot exists. |
| Authored strokes cannot supply this teaching comparison | `curriculum.learning` requires generated comparison evidence; use generated choices for that lesson. |
| Exactly three choices required | Group by first-contact `settings.ballId`, not by pocket or `potBallId`. |
| Authored position lesson needs a target | Supply the intended `objective.target`, or begin from a successfully prepared scenario. |
| Changing generation settings has no effect | Check for `authoredShots`, a specialized search's own tuning fields, and expanded fallback candidates. |
| Lab success differs from course success | Check the course objective, saved targets, player precision, trial count, and teaching requirements. |
