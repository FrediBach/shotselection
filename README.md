# Shot Selection

A browser game about choosing a repeatable pool shot, taught through a 60-level course. Progress from one-ball training drills to open-table choices, position play, patterns, traffic, and tournament situations. Select an object ball and one of three stroke options, then compare small variations in aim, pace, and spin to see which plan holds up best. Position lessons ask you to predict the cue-ball finish from the stroke before revealing its outcome.

Built with Vite, React, TypeScript, three.js / React Three Fiber, cannon-es, and shadcn-style Radix UI components.

## Run locally

Use a current Node.js LTS release compatible with Vite 7 (Node 20.19+ or 22.12+).

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. The app runs in the browser; no account, API key, or backend is required.

```sh
npm run typecheck
npm test
npm run test:e2e
npm run build
npm run preview
```

`npm run build` generates the static production site in `dist/`. `npm run preview` serves that build locally.

Browser tests use Playwright and an available local Chrome on macOS. On other systems, run `npx playwright install chromium` once, or set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to an installed Chromium browser. The test suite covers the complete round, comparison and replay flow, mobile controls, saved progress, and the WebGL fallback.

## Table rendering

The 3D table uses locally generated, seamless albedo, bump, and roughness maps for walnut, worsted cloth, and pocket leather. Texture coordinates follow the physical surface scale, including grain along each rail. The bed has six actual openings with recessed pocket wells, profiled cushions, beveled rails, and inlaid sights. Balls use polished resin materials and curved, lit number patches.

A local studio environment supplies overhead strip reflections, supported by soft directional shadows and contact shading. No remote texture or HDR downloads are required. The rendering shares the engine's playing-surface and ball dimensions; material and lighting changes do not alter shot calculations. The table uses a permanent top-down camera. The SVG fallback retains the controls and ensemble overlays. Browser appearance checks capture the overhead table at desktop, large, and mobile sizes.

## Play

First-time visitors see the instructions automatically; dismissing them saves that preference in this browser and opens the first level briefing. Each level begins with a dialog containing its objective, learning focus, and a short watch-out. Press **Start level** to play, and use the book button beside the table to **Review level briefing** without losing your selection. Resuming an unfinished level or restarting the course also shows its briefing. Open **How to play** in the header to read the general instructions again. If browser storage is unavailable, the game still works, but the instructions can reappear on the next visit.

1. In **Ball**, choose an available object ball on the table or in the sidebar, then continue to the finish or stroke choice. Position lessons specify the first ball and reserve another for the next shot.
2. In ordinary lessons, **Finish** offers three marked cue-ball endpoints: A, B, or C. In position lessons, **Stroke** offers three pocket, speed, and spin profiles in the sidebar. Read the cut angle, cushions, and traffic to predict which stroke will reach the marked zone. Candidate endpoints and paths stay hidden until you commit.
3. Press **Lock in your shot** to reach **Result** and reveal the ensemble comparison.
4. Inspect the candidate paths, potting and position rates, cue-ball spread, and stroke tolerance comparison. Rotate the 3D sample volume to see which combinations of aim, English, and strength still work.
5. Read the lesson takeaway, play the best shot, then advance to the next lesson. The final level opens a course summary.

The sidebar shows one step at a time so its controls fit without scrolling at normal text size, while the table and action buttons keep their position. **Back to balls** preserves the choice for the same ball; selecting a different ball clears it. In ordinary lessons, selecting another ball directly on the table during Finish keeps you on that step and shows its three options. Those lessons retain their A/B/C endpoint markers during Finish. Position lessons show the destination zone and reserved-ball ring, identified in the table legend, while all candidate outcomes remain hidden before commitment.

Each round awards 0–100 points in steps of 10. Up to 70 points reflect how close your shot's ensemble quality is to the best offered plan, and up to 30 reflect its rank among all offered choices. The Result step shows both contributions and their sum; each comparison card also shows its rank and round score. Both potting the chosen ball and controlling the cue-ball finish matter.

Score and progress are saved in this browser's local storage. Existing totals from the old 0 / 0.5 / 1 scoring system are converted once to the new scale by multiplying by 100, preserving completed rounds, perfect choices, level, and layout sequence. Completing a round saves the next unplayed level, so reloading after a verdict advances rather than scoring the same round twice. Restarting the session clears that progress and starts a new course. Older endless sessions map completed levels into the 60-level course, capped at completion, while preserving earned points, rounds, perfect choices, and the seed. Saved progress from the earlier 18-level course keeps its completed count and earned statistics; a finished 18-level course continues at level 19 without crediting or scoring unplayed levels.

## Course progression and position lessons

The course contains six scenarios, each with ten numbered levels:

| Levels | Scenario | Learning focus |
| --- | --- | --- |
| 1–10 | First strokes | One-ball pots, contact lines, and cue-ball movement |
| 11–20 | Everyday pool | Comparing open pots, distance, angle, and stroke choice |
| 21–30 | Play for position | Landing in a useful zone for a defined next ball |
| 31–40 | Build a pattern | Reading the whole table and planning backward |
| 41–50 | Navigate traffic | Clear corridors and reliable position among blockers |
| 51–60 | Tournament table | Combining longer pots, smaller zones, and stricter next-ball angles |

Each level has an authored layout, an objective, a short lesson, a specific teaching tip, and a result takeaway. Within each scenario, level 1 uses **New scenario** to introduce the task, levels 2–6 use **Build your skill** to develop it, and levels 7–10 use **Put it together** to apply the earlier skills with more demanding constraints. Later levels increase the demands on potting, cue-ball control, and table reading; position lessons progressively narrow the landing zone and allowed next-ball angle. Seeded reflections vary table orientation while retaining the teaching problem. The header shows completed levels, course percentage, and progress within each scenario. Completion measures lessons played; the existing 0–100 round score measures decision quality. A low score still advances the course so the result can serve as a lesson. Completing level 60 saves a completed course; reloading opens its summary without awarding points again. Starting a new course resets the session.

Position lessons define the first object ball and reserve a second ball for the next shot. A cyan zone marks the required cue-ball destination, and a ring highlights the reserved ball; the legend identifies both without text covering the cloth. Choose A/B/C from the sidebar's stroke profiles using the pocket, cue-ball speed, and backspin or topspin. Infer the likely route and stopping point from those settings and the table geometry. No candidate endpoint, path, or finish preview appears before commitment. After locking in the choice, inspect the simulated outcomes and compare them with your prediction. All three nominal strokes can pot the first ball; only outcomes satisfying the complete assignment count as successes.

Preparation chooses the shared zone from a feasible first-shot endpoint with a simulated, legal next-ball pot. Zones narrow from 20 cm to 12 cm radius through the course, while allowed next-ball cuts tighten from 65° to 40°. The zone is fixed before the player chooses; it never moves when another stroke or analysis card is selected. An explicitly supplied objective target is honored.

For every ensemble trial and tolerance sample, a full success requires:

1. Correct first contact and potting the required first ball.
2. No scratch, with all balls settled.
3. The cue-ball center inside the shared landing zone.
4. The reserved ball still on the table, with at least one clear direct route to a pocket within the lesson's cut-angle limit.

The next-shot check uses the actual final positions, including moved blockers, the ghost-ball contact position, clearance for a full ball along both paths, and pocket jaws. It is a geometric route check for each trial, not a second Monte Carlo shot or a guarantee of potting the next ball. The initial zone additionally has a simulated next-pot proof. Banks, kicks, and combinations are not considered. Result cards show **In zone** and **Next shot** rates separately; overall success requires both plus the legal first pot. These diagnostic rates can include trials that fail another requirement. Tolerance comparisons use exactly the same full-objective predicate.

## Ensemble and scoring

Before play, the planner searches up to two direct potting routes and 30 nominal stroke settings per object ball to find three feasible, distinct cue-ball finishes. An option is offered only when its nominal stroke contacts that ball first, pots it without scratching, and comes to rest with the cue ball fully on the playing surface. An endpoint marker, when shown, is the exact simulated endpoint, not an estimated or clamped preset. Position lessons keep that endpoint hidden until the player commits. Time-limited simulations that have not stopped cannot create options.

Each pair of a ball's options differs by at least 12 cm in finish position, 0.12 m/s in launch speed, and 0.35 in longitudinal spin relative to natural rolling. A, B, and C are assigned in increasing launch-speed order, before calculating any ensemble scores. A nominally feasible finish can still be difficult to reproduce with imperfect execution.

Balls without three qualifying finishes are unavailable for that layout. Preparation can try up to three other seeded orientations. Authored lessons retain their layout and teaching constraints; if no valid options can be found they report a preparation error with a retry action. Legacy custom layouts without lesson objectives can fall back to a known open layout whose options pass the same simulation checks. The prepared layout is what the game displays and evaluates. Finish positions are fixed options; the player does not place arbitrary targets on the cloth.

The ensemble evaluates the exact strokes used to generate the offered options. The verdict ranks every offered ball-and-finish pair, so the winning choice is always one the player could select. It does not introduce a hidden alternative after the player commits. The search currently excludes bank shots, kicks, combinations, and deliberate side-spin optimization.

Displayed speeds are initial cue-ball speeds in metres per second. Draw/follow percentages describe spin relative to natural rolling at that speed, not cue-tip contact offsets.

The game evaluates each candidate with 64 seeded Monte Carlo runs. (The engine's standalone API defaults to 48.) Independent normally distributed stroke perturbations have the following standard deviations:

| Input | Standard deviation |
| --- | --- |
| Aim | 0.0044 radians, approximately 0.25° |
| Speed | 3.5% of planned speed |
| Draw/follow spin | 0.085 of natural rolling spin |
| Side spin | 3 radians/second |

Candidates use the same random draws to make their comparison less noisy. For ordinary lessons, the target radius decreases gradually across all 60 course levels, from 19 cm at level 1 to 8 cm at level 60: `0.19 × (0.08 / 0.19)^((level - 1) / 59)` metres, with the level clamped to the course range. A successful run must contact the selected ball first, pot it, avoid a scratch, and finish the cue ball inside that zone. Position lessons instead use their shared objective zone and also require the next-ball route described above. The visible ring uses this same acceptance radius.

Preparation and analysis run in Web Workers to keep the interface responsive. The WebGL table and SVG fallback show the selected object ball's trajectories from all 64 scored trials, plus the first 24 cue-ball paths. Cyan object paths represent pots after correct first contact; coral paths represent misses or pots after incorrect first contact. Pale gold paths show the cue ball. Object paths include the actual simulated drop position instead of stopping at the last animation frame before the pocket.

The cyan-path fraction matches the displayed pot rate. A cyan object-ball pot may still be followed by a cue-ball scratch or a poor finish; the joint-success rate and utility score account for those failures. These are the same simulated trials used for scoring, not separately generated illustrations. The 3D table also shows cue-ball endpoints from completed, non-scratch samples. The replay shows the nominal stroke without random perturbations.

The utility score is:

```text
0.72 × P(legal pot and cue ball inside target)
+ 0.20 × mean(legal-pot indicator × exp(-target_error² / (2 × target_radius²)))
+ 0.08 × P(legal pot)
```

Missing the pot, scratching, or reaching the simulation time limit before coming to rest gives zero utility for that run. In position lessons the 72% joint-success term additionally requires the next-ball route, and the 20% proximity term also requires that route; the 8% legal-pot term remains partial credit. Round points are zero if a chosen plan has no full-objective successes. The score prioritizes a repeatable, successful outcome; the displayed root-mean-square endpoint spread is an additional diagnostic, not the score itself. Pot rate reports observed pots after correct first contact, including pots followed by a scratch, while joint success requires a completed, scratch-free result. Position rate reports stopping inside the target without a scratch, whether or not the object ball was potted.

Game points use that utility in two parts, each rounded to the nearest 10 points:

```text
quality points = round_to_10(70 × selected utility / best utility)
rank points    = round_to_10(30 × (number of choices − shared rank) / (number of choices − 1))
round points   = quality points + rank points
```

The quality component measures how much of the best available ensemble quality your choice retains. The rank component rewards placing ahead of other offered ball-and-finish pairs. A sole candidate receives the full 30 rank points. Both components are zero if the selected shot has no successful pot-and-safe-finish samples or the best utility is zero. Choosing a top-utility plan with at least one successful trial earns 100 even on a difficult layout: this measures shot selection relative to the available choices, not an absolute success probability.

To soften sampling noise, sort candidates by utility and group shots within 0.045 of each group's strongest member. Each group shares its first position in the ordering (for example, 1, 1, 3); anchoring to the strongest member prevents a chain of small differences from tying very different plans. These are game design choices, not a statistical significance test. Quality points still use each shot's own utility, so members of a shared rank can earn different totals. Session statistics track accumulated points, 100-point choices, and the percentage of available points earned.

## Stroke tolerance and success volume

After a round, **How much room does this shot give you?** compares the inspected candidate with the best offered shot from the ensemble ranking. The best shot is the same option used for the round verdict; this view does not optimize a new stroke or change the score. Selecting another comparison card updates the inspected margins and volume.

The six directional margins vary one input at a time around each candidate's planned stroke:

| Input | Displayed deviation | Search range |
| --- | --- | --- |
| Aim | Degrees left/right relative to the shot direction | ±2° |
| English | Added left/right side spin in radians/second | ±30 rad/s |
| Strength | Percentage change in initial cue-ball speed | ±30% |

**Pot + target** (or **Full objective** in position lessons) requires correct first contact, potting the selected ball, no scratch, all balls settled, and the cue-ball endpoint inside the candidate's target zone (or the shared objective zone for a position lesson). Position lessons also require a clear next-ball route. **Legal pot** uses the same safety conditions without requiring the target finish or next-ball route. Follow/draw and all other stroke settings stay fixed. The table reports the first sampled failure in each direction, scanning at 0.05° / 1 rad/s / 1% and refining the adjacent passing/failing bracket six times. It displays the passing side, rounded down. Later successful islands do not widen the reported margin. A ≥ value means the shot still passes at the search or physical speed limit; the failure boundary has not been found. Finite sampling can miss narrow gaps, so these are estimated local margins.

The rotatable **Sampled success volume** maps 441 combinations on a fixed 9 × 7 × 7 grid spanning the same ranges for every candidate, including the exact planned stroke. Grid spacing is 0.5°, 10 rad/s, and 10 percentage points of speed. A successful sample always requires both a legal pot and the target finish, independently of the margin table's condition switch. Follow/draw remains fixed for that candidate. The graph can show failed samples or a single strength slice. It uses individual points without a filled hull: neighboring passing points do not prove that every stroke between them passes. The sample share describes this uniform grid, not the player's success probability or an exact continuous volume. The engine's supported initial speed range is 0.05–4 m/s; points outside that range are marked unavailable and remain in the full-grid denominator. They are not simulated or silently clamped into duplicate strokes.

Tolerance calculations run in separate Web Workers after scoring, without replay-frame recording. Results are cached for the current round. Changing the inspected shot or advancing cancels pending work, and failures can be retried. The SVG 3D projection works without WebGL and supports dragging, keyboard rotation, and reset controls. Like the ensemble, these margins describe the model rather than calibrated real-table tolerances; in particular the simulation does not model cue deflection.

## Physical scale and accuracy

The table uses SI units and a 2.54 m × 1.27 m playing surface. Regulation pool balls have a 57.15 mm diameter. These dimensions follow the [WPA equipment specifications](https://wpapool.com/wp-content/uploads/2024/01/RECOMMENDED-EQUIPMENT-SPECIFICATIONS.pdf), which also specify corner pocket mouths of 114.3–117.5 mm, side mouths of 127–130.175 mm, and ball masses of 156–170 g.

Regulation dimensions do not establish predictive accuracy. Cloth friction, collision response, pocket capture, and player execution noise are simulation assumptions until validated against measurements from a real table. Ensemble percentages describe this model and its chosen noise distribution; they are not calibrated probabilities for an individual player.

The simulation advances cannon-es spheres at 240 Hz with planar motion. A separate cloth model transitions from sliding to rolling and carries draw/follow spin; cushion impulses couple side spin to rebound. `src/engine/table-geometry.ts` defines the six cushion noses, angled pocket facings, mouth points, and recessed round wells used by both the WebGL table and SVG fallback. Collision segments follow those same facings. A ball drops when its centre crosses the visible well edge after cushion collisions are resolved; crossing a table boundary alone does not count as a pot. Shot preparation aims at the recessed well centres so oblique entries account for the shelf. Analysis, tolerance calculations, and replay use the same solver.

The current model parameters are centralized in `src/engine/constants.ts`:

| Parameter | Value | Basis |
| --- | --- | --- |
| Playing surface | 2.54 × 1.27 m | WPA 9-foot dimensions |
| Ball diameter / mass | 57.15 mm / 170 g | Within WPA specifications |
| Corner / side pocket mouth | 114.3 mm / 127 mm | Lower end of WPA ranges |
| Corner / side horizontal jaw angle | 142° / 104° | WPA pocket cut angles |
| Corner / side shelf depth | 32 mm / 6.35 mm | Chosen within WPA ranges |
| Corner / side well diameter | 110 mm / 120 mm | Round-well approximation behind the shelf |
| Cushion depth | 50 mm | Within WPA cushion-width range |
| Sliding / rolling friction coefficients | 0.20 / 0.012 | Assumed cloth response |
| Ball / cushion restitution | 0.96 / 0.82 | Assumed collision response |
| Simulation time step | 1/240 second | Numerical choice |

The model omits jumps, masse, cue deflection, and table irregularities. Cushion elasticity, pocket shelf behavior, ball throw, and cloth response need measured validation before this could serve as a professional shot predictor.

This is a shot-selection exercise rather than an implementation of a full eight-ball or nine-ball ruleset. Rankings compare the candidate plans searched by the engine, not every physically possible shot.

For further physical validation, [Mathavan, Jackson, and Parkin's cushion-impact study](https://journals.sagepub.com/doi/10.1243/09544062JMES1964) illustrates why rebound behavior depends on speed, spin, and model assumptions. The project does not claim to implement that paper's complete collision model.

## Deployment

The intended public address is **shotselection.app**. This repository does not register the domain, configure DNS or TLS, or publish the site. A production deployment can serve the contents of `dist/` on a static host, with the domain connected separately.
