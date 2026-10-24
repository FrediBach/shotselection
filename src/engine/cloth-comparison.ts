import { distance } from './math';
import { simulateShot } from './physics';
import { evaluateShotObjective } from './objectives';
import type { Scenario, ShotPlan, Simulation } from './types';

/** Replay the identical launch after changing only the global cloth multiplier. */
export function compareCloth(source: Scenario, plan: ShotPlan, heavy: Simulation) {
  if (!source.conditions || (source.conditions.cloth ?? 1) <= 1) return null;
  const normal: Scenario = { ...source, conditions: { ...source.conditions, cloth: 1 } };
  const clean = simulateShot(normal, plan);
  return {
    variants: [
      { label: 'Heavy cloth', scenario: source, simulation: heavy },
      { label: 'Normal cloth', scenario: normal, simulation: clean },
    ].map(variant => ({ ...variant, outcome: evaluateShotObjective(variant.scenario, plan, variant.simulation) })),
    finishShift: distance(heavy.cueEnd, clean.cueEnd),
  };
}
