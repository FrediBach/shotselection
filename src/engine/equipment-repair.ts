import type { CharacterTalents, Scenario, ShotAnalysis, ShotPlan } from './types';

export function repairWinners(shots: ShotAnalysis[]) {
  const best = Math.max(...shots.map(s => s.score));
  return best > 0 ? shots.filter(s => Math.abs(s.score - best) < 1e-10).map(s => s.plan.id).sort() : [];
}

/** Rank the original offers under single repairs with identical indexed trials. */
export function compareEquipmentRepairs(source: Scenario, baseline: ShotAnalysis[], samples: number, talents: CharacterTalents | undefined,
  analyze: (scenario: Scenario, plan: ShotPlan, samples: number, talents?: CharacterTalents) => ShotAnalysis) {
  if (!source.conditions?.cue || !source.conditions.dirt || !source.conditions.cushions?.length) return undefined;
  const conditions = source.conditions;
  const originalWinners = repairWinners(baseline);
  const variants = [
    { label: 'Unchanged equipment', scenario: source, shots: baseline },
    ...[
      { label: 'Repair cue', scenario: { ...source, conditions: { ...conditions, cue: undefined } } },
      { label: 'Clean balls', scenario: { ...source, conditions: { ...conditions, dirt: 0 } } },
      { label: 'Restore rail', scenario: { ...source, conditions: { ...conditions, cushions: undefined } } },
    ].map(v => ({ ...v, shots: baseline.map(s => analyze(v.scenario, s.plan, samples, talents)) })),
  ].map(v => {
    const winners = repairWinners(v.shots);
    return { ...v, winners, changed: winners.join('|') !== originalWinners.join('|') };
  });
  return { samples, variants };
}
export type EquipmentRepairComparison = NonNullable<ReturnType<typeof compareEquipmentRepairs>>;
