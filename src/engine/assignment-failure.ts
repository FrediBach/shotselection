import { simulateShot } from './physics';
import { subtract } from './math';
import type { Scenario, FinishOption } from './types';
import type { ShotAnalysis } from './types';
export const ASSIGNMENT_CONDITIONS = ['Legal pot', 'Landing zone', 'Next-shot access'] as const;
/** Independent failures, not a first-failure classification. A trial can set several bits. */
export function assignmentFailureMask(legal: boolean, positioned: boolean, available: boolean): number {
  return (legal ? 0 : 1) | (positioned ? 0 : 2) | (available ? 0 : 4);
}
export function assignmentFailureSummary(shot: ShotAnalysis) {
  const masks = shot.assignmentFailures, flags = shot.trialSuccesses;
  if (!masks || !flags || !shot.samples || masks.length !== shot.samples || flags.length !== shot.samples
    || masks.some((mask, i) => !Number.isInteger(mask) || mask < 0 || mask > 7 || (mask === 0) !== flags[i])) return null;
  const combinations = Array<number>(8).fill(0);
  for (const mask of masks) combinations[mask]++;
  const failures = [1, 2, 4].map(bit => masks.filter(mask => (mask & bit) !== 0).length);
  const rates = [shot.legalPotRate, shot.positionRate, shot.nextShotRate];
  if (rates.some((rate, i) => rate === undefined || !Number.isFinite(rate) || Math.abs(1 - failures[i] / shot.samples - rate) > 1e-9)
    || Math.abs(combinations[0] / shot.samples - shot.successRate) > 1e-9) return null;
  const most = Math.max(...failures), failedTrials = shot.samples - combinations[0];
  return { combinations, failures, failedTrials, sum: failures.reduce((a, b) => a + b, 0),
    limiting: most ? failures.flatMap((count, i) => count === most ? [i] : []) : [] };
}

/** Fixed demonstration stroke: slightly stronger and 0.01 rad off the middle stroke's aim. */
export function assignmentPotProblem(source: Scenario, middle: FinishOption, last: FinishOption): FinishOption {
  const cue = source.balls.find(b => b.id === 0)!.position;
  const first = source.balls.find(b => b.id === source.objective!.ballId)!.position;
  const next = source.balls.find(b => b.id === source.objective!.nextBallId)!.position;
  const incoming = subtract(first, cue), onward = subtract(next, first);
  // A reflection reverses the angular offset; a rotation does not.
  const orientation = Math.sign(incoming.x * onward.y - incoming.y * onward.x) || 1;
  const plan = { ...middle.plan, id: last.id, label: `Ball ${middle.plan.ballId} · C · center`, speed: middle.plan.speed * 1.04,
    angle: middle.plan.angle - orientation * .01 };
  const simulation = simulateShot(source, plan, { record: false, recordPaths: true });
  return { ...last, plan: { ...plan, target: simulation.cueEnd }, cueApproachPath: simulation.cueApproachPath };
}
