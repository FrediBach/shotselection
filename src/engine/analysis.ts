import { TABLE } from './constants';
import { DEFAULT_CHARACTER, talentNoiseMultiplier } from './characters';
import { clamp, distance, normalRandom, seededRandom } from './math';
import { simulateShot } from './physics';
import { scoreSelection } from './scoring';
import { evaluateShotObjective, positionToleranceForScenario } from './objectives';
export { pointsFor } from './scoring';
import type { AnalyzeOptions, CharacterTalents, ObjectBallTrial, PreparedRound, RoundAnalysis, Scenario, Selection, ShotAnalysis, ShotPlan, SimulationBall, Vec2 } from './types';

export function analyzeShot(scenario: Scenario, plan: ShotPlan, samples = 48, talents: CharacterTalents = DEFAULT_CHARACTER.talents): ShotAnalysis {
  const count = clamp(Math.floor(samples), 8, 128);
  const tolerance = positionToleranceForScenario(scenario);
  const random = seededRandom(scenario.seed ^ 0x3A7B91);
  const nominal = simulateShot(scenario, plan);
  const angleNoise = talentNoiseMultiplier(talents.anglePrecision);
  const englishNoise = talentNoiseMultiplier(talents.englishPrecision);
  const strengthNoise = talentNoiseMultiplier(talents.strengthPrecision);
  const spinNoise = talentNoiseMultiplier(talents.spinPrecision);
  const endpoints: Vec2[] = [];
  const samplePaths: Vec2[][] = [];
  const sampleObjectPaths: ObjectBallTrial[] = [];
  const sampleBallEnds: SimulationBall[][] = [];
  let pots = 0;
  let scratches = 0;
  let positions = 0;
  let successes = 0;
  let legalPots = 0;
  let nextShots = 0;
  let quality = 0;
  // Same random perturbations for every candidate: common random numbers reduce
  // comparison noise. These are stroke errors, not invented success percentages.
  for (let index = 0; index < count; index++) {
    const perturbed: ShotPlan = {
      ...plan,
      angle: plan.angle + normalRandom(random) * (0.0044 + Math.abs(plan.sideSpin) * 0.000025) * angleNoise,
      speed: plan.speed * (1 + normalRandom(random) * 0.035 * strengthNoise),
      topSpin: plan.topSpin + normalRandom(random) * 0.085 * spinNoise,
      sideSpin: plan.sideSpin + normalRandom(random) * 3 * englishNoise,
    };
    const simulation = simulateShot(scenario, perturbed, { record: false, recordPaths: true });
    sampleBallEnds.push(simulation.finalBalls);
    const dropped = simulation.potted.includes(plan.potBallId ?? plan.ballId);
    const potted = dropped && simulation.firstContact === plan.ballId;
    sampleObjectPaths.push({ path: simulation.objectPath, outcome: potted ? 'pot' : dropped ? 'foul' : 'miss' });
    const { legalPot: legal, error, positioned, nextShotAvailable, success } = evaluateShotObjective(scenario, plan, simulation);
    if (potted) pots++;
    if (simulation.scratch) scratches++;
    if (positioned) positions++;
    if (legal) legalPots++;
    if (success) successes++;
    if (nextShotAvailable) nextShots++;
    if (legal && nextShotAvailable) quality += Math.exp(-(error * error) / (2 * tolerance ** 2));
    if (!simulation.scratch && simulation.stopped) endpoints.push(simulation.cueEnd);
    if (index < 24) samplePaths.push(simulation.cuePath);
  }
  const meanEnd = endpoints.length ? { x: endpoints.reduce((sum, p) => sum + p.x, 0) / endpoints.length, y: endpoints.reduce((sum, p) => sum + p.y, 0) / endpoints.length } : nominal.cueEnd;
  const spread = endpoints.length ? Math.sqrt(endpoints.reduce((sum, p) => sum + distance(p, meanEnd) ** 2, 0) / endpoints.length) : Math.hypot(TABLE.length, TABLE.width);
  const successRate = successes / count;
  // Pot AND position dominates. A missed pot or scratch never earns utility.
  const score = (0.72 * successes + 0.2 * quality + 0.08 * legalPots) / count;
  const isPlant = plan.potBallId !== undefined && plan.potBallId !== plan.ballId;
  const explanation = isPlant
    ? sampleObjectPaths.every(trial => trial.outcome === 'miss') && !nominal.potted.includes(plan.potBallId!)
      ? `The attempted plant does not pot ball ${plan.potBallId} in the nominal stroke or any sampled trial. Compare its line with the free ball.`
      : successRate >= 0.8
        ? `The plant sends ball ${plan.potBallId} into the pocket with a repeatable cue-ball finish. Small stroke errors remain manageable.`
        : pots / count < 0.55
          ? `The plant has little margin: errors at the first contact change how ball ${plan.ballId} reaches ball ${plan.potBallId}. A difficult free ball can still be the better choice.`
          : scratches / count > 0.12
            ? 'The plant can pot, but the cue ball runs close to a pocket. Scratch risk weakens this choice.'
            : 'The plant can pot, but speed and spin need care to hold the chosen cue-ball finish. Compare that control with the free ball.'
    : scenario.objective
    ? successRate >= 0.8
      ? `A reliable pot and a controlled finish in the landing zone leave ball ${scenario.objective.nextBallId} available.`
      : nextShots / count < 0.55
        ? `Potting alone is not enough: this finish often leaves ball ${scenario.objective.nextBallId} blocked or too thin. Look for a clearer next-ball angle.`
        : `Ball ${scenario.objective.nextBallId} can be played from this side, but pace and spin must hold the shared landing zone after a legal pot.`
    : successRate >= 0.8
    ? 'A generous pot and a repeatable cue-ball finish. Small stroke errors stay manageable.'
    : pots / count < 0.55
      ? 'The pot has a narrow margin. Small changes in aim often miss the pocket.'
      : scratches / count > 0.12
        ? 'The cue ball runs close to a pocket. Scratch risk makes this route less dependable.'
        : 'The pot is available, but speed and spin need care to hold the chosen cue-ball position.';
  return { plan, successRate, potRate: pots / count, legalPotRate: legalPots / count, targetQuality: quality / count, scratchRate: scratches / count, positionRate: positions / count, ...(scenario.objective ? { nextShotRate: nextShots / count } : {}), spread, meanEnd, samplePaths, sampleObjectPaths, sampleEnds: endpoints, sampleBallEnds, score, nominal, samples: count, explanation };
}

export function analyzeRound(prepared: PreparedRound, selection: Selection, options: AnalyzeOptions = {}): RoundAnalysis {
  const offered = prepared.balls.flatMap(ball => ball.options);
  const chosen = offered.find(option => option.id === selection.optionId && option.plan.ballId === selection.ballId);
  if (!chosen) throw new Error('This finish is not available in the current round. Choose one of the offered options.');
  const { scenario } = prepared;
  // Each fixed plan is evaluated exactly once. No target optimization or unseen
  // alternatives are introduced after the player has made their decision.
  const candidates = offered.map(option => analyzeShot(scenario, option.plan, options.samples ?? 48, options.talents));
  const selected = candidates.find(candidate => candidate.plan.id === chosen.id)!;
  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];
  const scoring = scoreSelection(selected, candidates);
  return { candidates, selected, best, points: scoring.points, scoring, samples: selected.samples, positionTolerance: positionToleranceForScenario(scenario) };
}
