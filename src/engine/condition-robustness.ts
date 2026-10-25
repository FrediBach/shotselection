import { repairWinners } from './equipment-repair';
import { tuningList } from './lesson-tuning';
import type { CharacterTalents, Scenario, ShotAnalysis, ShotPlan } from './types';

/** Fixed uncertainty probes, sharing offered plans and indexed execution errors. */
export function compareConditionRobustness(source: Scenario, baseline: ShotAnalysis[], samples: number, talents: CharacterTalents | undefined,
  analyze: (scenario: Scenario, plan: ShotPlan, samples: number, talents?: CharacterTalents) => ShotAnalysis) {
  const conditions = source.conditions;
  if (!conditions?.cloth || !conditions.nap) return undefined;
  const percent = (multiplier: number) => `${multiplier < 1 ? '−' : '+'}${Number((Math.abs(multiplier - 1) * 100).toFixed(6))}%`;
  const probes = [
    ...tuningList(source, 'robustnessClothMultipliers').map(multiplier => ({ label: `Drag ${percent(multiplier)}`, conditions: { ...conditions, cloth: conditions.cloth! * multiplier } })),
    ...tuningList(source, 'robustnessNapMultipliers').map(multiplier => ({ label: `Drift ${percent(multiplier)}`, conditions: { ...conditions, nap: { x: conditions.nap!.x * multiplier, y: conditions.nap!.y * multiplier } } })),
  ];
  const variants = [
    { label: 'Reported conditions', scenario: source, shots: baseline },
    ...probes.map(p => { const scenario = { ...source, conditions: p.conditions }; return { label: p.label, scenario, shots: baseline.map(s => analyze(scenario, s.plan, samples, talents)) }; }),
  ];
  const routes = baseline.map(shot => {
    const scores = variants.map(v => v.shots.find(s => s.plan.id === shot.plan.id)!.score);
    return { optionId: shot.plan.id, reported: shot.score, worst: Math.min(...scores), best: Math.max(...scores), scores };
  });
  const maximum = Math.max(...routes.map(r => r.worst));
  const robust = maximum > 0 ? routes.filter(r => Math.abs(r.worst - maximum) < 1e-10).map(r => r.optionId).sort() : [];
  return { samples, variants, routes, reported: repairWinners(baseline), robust };
}
export type ConditionRobustnessComparison = NonNullable<ReturnType<typeof compareConditionRobustness>>;
