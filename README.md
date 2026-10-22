# Shot Selection

A browser game about choosing a repeatable pool shot. Select an object ball and one of three feasible cue-ball finishes, then compare small variations in aim, pace, and spin to see which plan holds up best.

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

The table opens directly below the header. First-time visitors see the instructions automatically; dismissing them saves that preference in this browser. Open **How to play** in the header to read them again. If browser storage is unavailable, the game still works, but the instructions can reappear on the next visit.

1. In **Ball**, choose an available object ball on the table or in the sidebar, then press **Choose a finish**.
2. In **Finish**, choose one of its three marked cue-ball finishes: A, B, or C. Each comes from a simulated successful stroke; the options differ in how forgiving they are.
3. Press **Lock in your shot** to reach **Result** and reveal the ensemble comparison.
4. Inspect the candidate paths, potting and position rates, and cue-ball spread.
5. Play the best shot, then advance to a harder layout.

The sidebar shows one step at a time so its controls fit without scrolling at normal text size, while the table and action buttons keep their position. **Back to balls** preserves the finish for the same ball; selecting a different ball clears it. In Finish, selecting another ball directly on the table keeps you on that step and shows its three options. Table finish markers appear only during Finish.

The round awards one point for a best-equivalent plan, half a point for a close alternative, and zero for a weak choice. The engine evaluates each full plan: both potting the chosen ball and controlling the cue-ball finish matter.

Score and progress are saved in this browser's local storage. Completing a round saves the next unplayed level, so reloading after a verdict advances rather than scoring the same round twice. Restarting the session clears that progress and generates a new layout sequence.

## Ensemble and scoring

Before play, the planner searches up to two direct potting routes and 30 nominal stroke settings per object ball to find three feasible, distinct cue-ball finishes. A finish is offered only when its associated nominal stroke contacts that ball first, pots it without scratching, and comes to rest with the cue ball fully on the playing surface. The marker is the exact simulated endpoint, not an estimated or clamped preset. Time-limited simulations that have not stopped cannot create options.

Each pair of a ball's options differs by at least 12 cm in finish position, 0.12 m/s in launch speed, and 0.35 in longitudinal spin relative to natural rolling. A, B, and C are assigned in increasing launch-speed order, before calculating any ensemble scores. A nominally feasible finish can still be difficult to reproduce with imperfect execution.

Balls without three qualifying finishes are unavailable for that layout. If none are available, preparation tries up to three other seeded layouts, then a known open layout whose options must pass the same simulation checks. The prepared layout is what the game displays and evaluates. Finish positions are fixed options; the player does not place arbitrary targets on the cloth.

The ensemble evaluates the exact strokes used to generate the offered options. The verdict ranks every offered ball-and-finish pair, so the winning choice is always one the player could select. It does not introduce a hidden alternative after the player commits. The search currently excludes bank shots, kicks, combinations, and deliberate side-spin optimization.

Displayed speeds are initial cue-ball speeds in metres per second. Draw/follow percentages describe spin relative to natural rolling at that speed, not cue-tip contact offsets.

The game evaluates each candidate with 64 seeded Monte Carlo runs. (The engine's standalone API defaults to 48.) Independent normally distributed stroke perturbations have the following standard deviations:

| Input | Standard deviation |
| --- | --- |
| Aim | 0.0044 radians, approximately 0.25° |
| Speed | 3.5% of planned speed |
| Draw/follow spin | 0.085 of natural rolling spin |
| Side spin | 3 radians/second |

Candidates use the same random draws to make their comparison less noisy. The target zone starts with a 19 cm radius and shrinks by 6% per level to an 8 cm minimum: `max(0.08, 0.19 × 0.94^(level - 1))` metres. A successful run must contact the selected ball first, pot it, avoid a scratch, and finish the cue ball inside that zone. The visible ring uses this same acceptance radius.

Preparation and analysis run in Web Workers to keep the interface responsive. The WebGL table and SVG fallback show the selected object ball's trajectories from all 64 scored trials, plus the first 24 cue-ball paths. Cyan object paths represent pots after correct first contact; coral paths represent misses or pots after incorrect first contact. Pale gold paths show the cue ball. Object paths include the actual simulated drop position instead of stopping at the last animation frame before the pocket.

The cyan-path fraction matches the displayed pot rate. A cyan object-ball pot may still be followed by a cue-ball scratch or a poor finish; the joint-success rate and utility score account for those failures. These are the same simulated trials used for scoring, not separately generated illustrations. The 3D table also shows cue-ball endpoints from completed, non-scratch samples. The replay shows the nominal stroke without random perturbations.

The utility score is:

```text
0.72 × P(legal pot and cue ball inside target)
+ 0.20 × mean(legal-pot indicator × exp(-target_error² / (2 × target_radius²)))
+ 0.08 × P(legal pot)
```

Missing the pot, scratching, or reaching the simulation time limit before coming to rest gives zero utility for that run. The score prioritizes a repeatable, successful outcome; the displayed root-mean-square endpoint spread is an additional diagnostic, not the score itself. Pot rate reports observed pots after correct first contact, including pots followed by a scratch, while joint success requires a completed, scratch-free result. Position rate reports stopping inside the target without a scratch, whether or not the object ball was potted.

A plan scores one game point when its utility is within 0.045 of the best candidate. It scores half a point when within 0.18 and at least 72% of the best utility. Both awards require at least one joint-success sample; otherwise the award is zero. These thresholds are game design choices. With 64 samples, small probability differences are noisy, so close plans are intentionally treated as equivalent; this is not a statistical significance test.

## Physical scale and accuracy

The table uses SI units and a 2.54 m × 1.27 m playing surface. Regulation pool balls have a 57.15 mm diameter. These dimensions follow the [WPA equipment specifications](https://wpapool.com/wp-content/uploads/2024/01/RECOMMENDED-EQUIPMENT-SPECIFICATIONS.pdf), which also specify corner pocket mouths of 114.3–117.5 mm, side mouths of 127–130.175 mm, and ball masses of 156–170 g.

Regulation dimensions do not establish predictive accuracy. Cloth friction, collision response, pocket capture, and player execution noise are simulation assumptions until validated against measurements from a real table. Ensemble percentages describe this model and its chosen noise distribution; they are not calibrated probabilities for an individual player.

The simulation advances cannon-es spheres at 240 Hz with planar motion. A separate cloth model transitions from sliding to rolling and carries draw/follow spin; cushion impulses couple side spin to rebound. Finite cushion segments leave six pocket openings, with angled jaws and simplified drop tests. Replay uses frames from the same solver as the analysis.

The current model parameters are centralized in `src/engine/constants.ts`:

| Parameter | Value | Basis |
| --- | --- | --- |
| Playing surface | 2.54 × 1.27 m | WPA 9-foot dimensions |
| Ball diameter / mass | 57.15 mm / 170 g | Within WPA specifications |
| Corner / side pocket mouth | 114.3 mm / 127 mm | Lower end of WPA ranges |
| Sliding / rolling friction coefficients | 0.20 / 0.012 | Assumed cloth response |
| Ball / cushion restitution | 0.96 / 0.82 | Assumed collision response |
| Simulation time step | 1/240 second | Numerical choice |

The model omits jumps, masse, cue deflection, and table irregularities. Cushion elasticity, pocket shelf behavior, ball throw, and cloth response need measured validation before this could serve as a professional shot predictor.

This is a shot-selection exercise rather than an implementation of a full eight-ball or nine-ball ruleset. Rankings compare the candidate plans searched by the engine, not every physically possible shot.

For further physical validation, [Mathavan, Jackson, and Parkin's cushion-impact study](https://journals.sagepub.com/doi/10.1243/09544062JMES1964) illustrates why rebound behavior depends on speed, spin, and model assumptions. The project does not claim to implement that paper's complete collision model.

## Deployment

The intended public address is **shotselection.app**. This repository does not register the domain, configure DNS or TLS, or publish the site. A production deployment can serve the contents of `dist/` on a static host, with the domain connected separately.
