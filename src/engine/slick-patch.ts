import { clipPatchPath } from './patch-route';
import { simulateShot } from './physics';
import { distance } from './math';
import { evaluateShotObjective } from './objectives';
import type { Scenario, ShotPlan, Simulation } from './types';

/** Replace only the slick patch with ordinary cloth; retain the sticky repair. */
export function compareSlickPatch(source: Scenario, plan: ShotPlan, actual: Simulation) {
  const slick = source.conditions?.patches?.filter(p => p.friction < 1);
  if (slick?.length !== 1) return null;
  const patch = slick[0];
  const ordinary: Scenario = { ...source, conditions: { ...source.conditions!, patches: source.conditions!.patches!.map(p => p.id === patch.id ? { ...p, friction: 1 } : p) } };
  const comparison = simulateShot(ordinary, plan);
  return { slick: patch, finishShift: distance(actual.cueEnd, comparison.cueEnd), variants: [
    { label: 'Slick patch', scenario: source, simulation: actual },
    { label: 'Ordinary replacement', scenario: ordinary, simulation: comparison },
  ].map(v => ({ ...v, outcome: evaluateShotObjective(v.scenario, plan, v.simulation),
    routes: [v.simulation.cuePath, v.simulation.objectPath].map((path, i) => ({ label: i ? `Ball ${plan.ballId}` : 'Cue', path,
      crossings: v.scenario.conditions!.patches!.map(p => {
        const segments = clipPatchPath(path, p.center, p.radius);
        return { patch: p, segments, length: segments.reduce((sum, [a, b]) => sum + distance(a, b), 0) };
      }),
    })),
  })) };
}
