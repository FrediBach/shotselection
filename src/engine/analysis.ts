import { TABLE, positionToleranceForLevel } from './constants';
import { clamp, distance, normalRandom, seededRandom } from './math';
import { simulateShot } from './physics';
import { scoreSelection } from './scoring';
export { pointsFor } from './scoring';
import type { AnalyzeOptions, ObjectBallTrial, PreparedRound, RoundAnalysis, Scenario, Selection, ShotAnalysis, ShotPlan, SimulationBall, Vec2 } from './types';

export function analyzeShot(scenario: Scenario, plan: ShotPlan, samples = 48): ShotAnalysis {
  const count = clamp(Math.floor(samples), 8, 128);
  const tolerance = positionToleranceForLevel(scenario.level);
  const random = seededRandom(scenario.seed ^ 0x3A7B91);
  const nominal = simulateShot(scenario, plan);
  const endpoints: Vec2[] = [];
  const samplePaths: Vec2[][] = [];
  const sampleObjectPaths: ObjectBallTrial[] = [];
  const sampleBallEnds: SimulationBall[][] = [];
  let pots = 0;
  let scratches = 0;
  let positions = 0;
  let successes = 0;
  let legalPots = 0;
  let quality = 0;
  // Same random perturbations for every candidate: common random numbers reduce
  // comparison noise. These are stroke errors, not invented success percentages.
  for (let index = 0; index < count; index++) {
    const perturbed: ShotPlan = {
      ...plan,
      angle: plan.angle + normalRandom(random) * (0.0044 + Math.abs(plan.sideSpin) * 0.000025),
      speed: plan.speed * (1 + normalRandom(random) * 0.035),
      topSpin: plan.topSpin + normalRandom(random) * 0.085,
      sideSpin: plan.sideSpin + normalRandom(random) * 3,
    };
    const simulation = simulateShot(scenario, perturbed, { record: false, recordPaths: true });
    sampleBallEnds.push(simulation.finalBalls);
    const dropped = simulation.potted.includes(plan.ballId);
    const potted = dropped && simulation.firstContact === plan.ballId;
    sampleObjectPaths.push({ path: simulation.objectPath, outcome: potted ? 'pot' : dropped ? 'foul' : 'miss' });
    const legal = potted && !simulation.scratch && simulation.stopped;
    const error = distance(simulation.cueEnd, plan.target);
    const positioned = !simulation.scratch && simulation.stopped && error <= tolerance;
    if (potted) pots++;
    if (simulation.scratch) scratches++;
    if (positioned) positions++;
    if (legal) legalPots++;
    if (legal && positioned) successes++;
    if (legal) quality += Math.exp(-(error * error) / (2 * tolerance ** 2));
    if (!simulation.scratch && simulation.stopped) endpoints.push(simulation.cueEnd);
    if (index < 24) samplePaths.push(simulation.cuePath);
  }
  const meanEnd = endpoints.length ? { x: endpoints.reduce((sum, p) => sum + p.x, 0) / endpoints.length, y: endpoints.reduce((sum, p) => sum + p.y, 0) / endpoints.length } : nominal.cueEnd;
  const spread = endpoints.length ? Math.sqrt(endpoints.reduce((sum, p) => sum + distance(p, meanEnd) ** 2, 0) / endpoints.length) : Math.hypot(TABLE.length, TABLE.width);
  const successRate = successes / count;
  // Pot AND position dominates. A missed pot or scratch never earns utility.
  const score = (0.72 * successes + 0.2 * quality + 0.08 * legalPots) / count;
  const explanation = successRate >= 0.8
    ? 'A generous pot and a repeatable cue-ball finish. Small stroke errors stay manageable.'
    : pots / count < 0.55
      ? 'The pot has a narrow margin. Small changes in aim often miss the pocket.'
      : scratches / count > 0.12
        ? 'The cue ball runs close to a pocket. Scratch risk makes this route less dependable.'
        : 'The pot is available, but speed and spin need care to hold the chosen cue-ball position.';
  return { plan, successRate, potRate: pots / count, scratchRate: scratches / count, positionRate: positions / count, spread, meanEnd, samplePaths, sampleObjectPaths, sampleEnds: endpoints, sampleBallEnds, score, nominal, samples: count, explanation };
}

export function analyzeRound(prepared: PreparedRound, selection: Selection, options: AnalyzeOptions = {}): RoundAnalysis {
  const offered = prepared.balls.flatMap(ball => ball.options);
  const chosen = offered.find(option => option.id === selection.optionId && option.plan.ballId === selection.ballId);
  if (!chosen) throw new Error('This finish is not available in the current round. Choose one of the offered options.');
  const { scenario } = prepared;
  // Each fixed plan is evaluated exactly once. No target optimization or unseen
  // alternatives are introduced after the player has made their decision.
  const candidates = offered.map(option => analyzeShot(scenario, option.plan, options.samples ?? 48));
  const selected = candidates.find(candidate => candidate.plan.id === chosen.id)!;
  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];
  const scoring = scoreSelection(selected, candidates);
  return { candidates, selected, best, points: scoring.points, scoring, samples: selected.samples, positionTolerance: positionToleranceForLevel(scenario.level) };
}
