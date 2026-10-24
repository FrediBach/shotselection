import type { Scenario, ShotAnalysis, ShotPlan, Simulation } from './types';
export const PLANT_FAILURE_LINKS = ['delivery', 'transfer', 'pot', 'finish'] as const;
export type PlantFailureLink = typeof PLANT_FAILURE_LINKS[number];
export type PlantTrialStage = PlantFailureLink | 'success' | 'unsettled';
export const PLANT_STAGE_LABELS: Record<PlantTrialStage, string> = {
  delivery: 'First delivery', transfer: '1 → 2 transfer', pot: 'Target pot', finish: 'Cue-ball finish',
  success: 'Complete success', unsettled: 'Unsettled',
};
/** First failed observed link in a settled scoring trial. Success uses the scoring predicate. */
export function plantTrialStage(source: Scenario, plan: ShotPlan, s: Simulation, success: boolean): PlantTrialStage | null {
  const plant = source.plant;
  if (!plant || plan.ballId !== plant.ballId || plan.potBallId !== plant.targetBallId) return null;
  if (success) return 'success';
  if (!s.stopped) return 'unsettled';
  if (s.firstContact !== plant.ballId) return 'delivery';
  const contacts = s.ballContacts ?? [];
  const cueIndex = contacts.findIndex(([a, b]) => (a === 0 && b === plant.ballId) || (b === 0 && a === plant.ballId));
  const transferred = cueIndex >= 0 && contacts.slice(cueIndex + 1).some(([a, b]) =>
    (a === plant.ballId && b === plant.targetBallId) || (b === plant.ballId && a === plant.targetBallId));
  if (!transferred) return 'transfer';
  if (!s.potted.includes(plant.targetBallId)) return 'pot';
  return 'finish';
}
export function plantFailureSummary(shot: ShotAnalysis) {
  const stages = shot.plantTrialStages, successes = shot.trialSuccesses;
  if (!stages || !successes || stages.length !== shot.samples || successes.length !== shot.samples || !shot.samples) return null;
  const counts: Record<PlantTrialStage, number> = { delivery: 0, transfer: 0, pot: 0, finish: 0, success: 0, unsettled: 0 };
  for (let i = 0; i < stages.length; i++) {
    const stage = stages[i];
    if (!(stage in counts) || (stage === 'success') !== successes[i]) return null;
    counts[stage]++;
  }
  if (Math.abs(counts.success / shot.samples - shot.successRate) > 1e-9) return null;
  const most = Math.max(...PLANT_FAILURE_LINKS.map(key => counts[key]));
  return { counts, trials: shot.samples, failures: shot.samples - counts.success,
    limiting: most ? PLANT_FAILURE_LINKS.filter(key => counts[key] === most) : [], most };
}
