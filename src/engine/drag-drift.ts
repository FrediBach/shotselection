import { simulateShot } from './physics';
import { evaluateShotObjective } from './objectives';
import type { Scenario, ShotPlan, Simulation } from './types';

export function compareDragDrift(source: Scenario, plan: ShotPlan, nominal: Simulation) {
  if ((source.conditions?.cloth ?? 1) <= 1 || !source.conditions?.nap) return null;
  const conditions = source.conditions;
  const scenarios = [
    { label: 'Both faults', scenario: source },
    { label: 'Slow cloth only', scenario: { ...source, conditions: { ...conditions, nap: undefined } } },
    { label: 'Drift only', scenario: { ...source, conditions: { ...conditions, cloth: 1 } } },
  ];
  return [.9, 1, 1.25].map((scale, index) => {
    const stroke = { ...plan, speed: plan.speed * scale };
    return { label: ['90% pace', 'Original pace', '125% pace'][index], scale, plan: stroke,
      variants: scenarios.map((entry, i) => {
        const simulation = scale === 1 && i === 0 ? nominal : simulateShot(entry.scenario, stroke);
        return { ...entry, simulation, outcome: evaluateShotObjective(entry.scenario, stroke, simulation) };
      }),
    };
  });
}
