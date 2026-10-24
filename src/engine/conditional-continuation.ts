import { DEFAULT_CHARACTER } from './characters';
import { distance, seededRandom } from './math';
import { directShotRoutes, evaluateShotObjective } from './objectives';
import { simulateShot } from './physics';
import { secondShotPlan, secondShotPotted } from './second-shot';
import { sequenceLayout } from './sequence-reliability';
import { perturbShot } from './stroke-errors';
import type { CharacterTalents, FinishOption, Scenario, ShotAnalysis, ShotPlan, SimulationBall } from './types';

function settledLayout(source: Scenario, balls: SimulationBall[]): Scenario {
  return { level: source.level, seed: source.seed, title: 'Sampled continuation', description: '', conditions: source.conditions,
    balls: balls.filter(b => !b.pocketed).map(b => ({ id: b.id, position: { ...b.position } })) };
}
export function continuationRoute(source: Scenario, balls: SimulationBall[], second: ShotPlan) {
  return directShotRoutes(settledLayout(source, balls).balls, second.ballId, source.objective!.maxCutAngle).find(r => r.pocketId === second.pocketId);
}
/** Choose a nominally proven response before any error ensemble, never from its scores. */
export function continuationPreview(source: Scenario, options: FinishOption[]) {
  if (!source.objective) return null;
  for (const option of options) {
    const nominal = simulateShot(source, option.plan, { record: false });
    if (!evaluateShotObjective(source, option.plan, nominal).legalPot) continue;
    const after = sequenceLayout(source, nominal);
    for (const route of directShotRoutes(after.balls, source.objective.nextBallId, source.objective.maxCutAngle)) {
      for (const pace of [1.8, 1.5, 1.2, .95]) for (const spin of [0, -.7, 1]) {
        const second = secondShotPlan(after, source.objective.nextBallId, route, pace, spin);
        if (!secondShotPotted(second.ballId, simulateShot(after, second, { record: false }))) continue;
        const probes = [.99, 1, 1.01].map(multiplier => {
          const plan = { ...option.plan, speed: option.plan.speed * multiplier };
          const first = simulateShot(source, plan, { record: false, recordPaths: true });
          const legal = evaluateShotObjective(source, plan, first).legalPot;
          const nextRoute = legal ? continuationRoute(source, first.finalBalls, second) : undefined;
          return { multiplier, first, legal, cut: nextRoute?.cutAngle ?? null,
            approach: nextRoute ? distance(first.cueEnd, nextRoute.ghost) : null };
        });
        return { referenceId: option.id, second, probes };
      }
    }
  }
  return null;
}
export type ContinuationPreview = NonNullable<ReturnType<typeof continuationPreview>>;
export function summarizeContinuation(trials: { firstLegal: boolean; available: boolean; completed: boolean; nominalCompleted: boolean }[]) {
  const count = trials.length;
  const firstLegal = trials.filter(t => t.firstLegal).length, available = trials.filter(t => t.available).length;
  const completed = trials.filter(t => t.completed).length, nominalCompleted = trials.filter(t => t.nominalCompleted).length;
  return { count, firstLegal, available, completed, nominalCompleted,
    conditional: firstLegal ? completed / firstLegal : null,
    sequence: count ? completed / count : null,
    naive: count ? (firstLegal / count) * (nominalCompleted / count) : null };
}
/** Reuse the opener's scoring outcomes. Independent second-shot errors are paired
 * between actual and nominal landings, including indices whose opener failed. */
export function analyzeContinuation(source: Scenario, preview: ContinuationPreview, first: ShotAnalysis, talents: CharacterTalents = DEFAULT_CHARACTER.talents) {
  if (first.plan.id !== preview.referenceId || first.trialLegalPots?.length !== first.samples || first.sampleBallEnds.length !== first.samples) return null;
  const second = preview.second, nominalLayout = sequenceLayout(source, first.nominal);
  const random = seededRandom(source.seed ^ 0x2C71A9);
  const trials = Array.from({ length: first.samples }, (_, i) => {
    const perturbed = perturbShot(second, random, talents);
    const nominalCompleted = secondShotPotted(second.ballId, simulateShot(nominalLayout, perturbed, { record: false }));
    const firstLegal = first.trialLegalPots![i], balls = first.sampleBallEnds[i];
    const route = firstLegal ? continuationRoute(source, balls, second) : undefined;
    const adjusted = route ? { ...perturbed, angle: route.angle + (perturbed.angle - second.angle) } : undefined;
    const completed = Boolean(adjusted && secondShotPotted(second.ballId, simulateShot(settledLayout(source, balls), adjusted, { record: false })));
    return { firstLegal, available: Boolean(route), completed, nominalCompleted };
  });
  return { referenceId: preview.referenceId, trials, ...summarizeContinuation(trials) };
}
export type ContinuationAnalysis = NonNullable<ReturnType<typeof analyzeContinuation>>;
