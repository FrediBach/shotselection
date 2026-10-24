import { cueStroke } from './table-conditions';
import { simulateShot } from './physics';
import { distance } from './math';
import { evaluateShotObjective } from './objectives';
import type { Scenario, ShotPlan, Simulation } from './types';

/** Restore spin delivery alone, retaining the house cue's power and aim bias. */
export function compareHouseCue(source: Scenario, plan: ShotPlan, worn: Simulation) {
  const cue = source.conditions?.cue;
  if (!cue || cue.spin >= 1) return null;
  const restored: Scenario = { ...source, conditions: { ...source.conditions!, cue: { ...cue, spin: 1 } } };
  const simulation = simulateShot(restored, plan);
  return { requested: { topSpin: plan.topSpin, sideSpin: plan.sideSpin, speed: plan.speed },
    delivered: cueStroke(plan, source.conditions), restored: cueStroke(plan, restored.conditions),
    finishShift: distance(worn.cueEnd, simulation.cueEnd),
    variants: [
      { label: 'House cue', scenario: source, simulation: worn },
      { label: 'Spin restored', scenario: restored, simulation },
    ].map(v => ({ ...v, outcome: evaluateShotObjective(v.scenario, plan, v.simulation) })),
  };
}
