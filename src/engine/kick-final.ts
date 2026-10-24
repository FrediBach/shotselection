import { kickIntroductionEvidence } from './kick-introduction';
import { directionDifference } from './kick-spin';
import { distance } from './math';
import { simulateShot } from './physics';
import type { FinishOption, Scenario, ShotPlan, Simulation } from './types';
export interface KickFinalPreview { referenceId: string; simulation: Simulation }
export function kickFinalEvidence(source: Scenario, plan: ShotPlan, simulation: Simulation) {
  const base = kickIntroductionEvidence(source, simulation), contact = simulation.cueContacts?.[0];
  if (!base || source.bank?.minCushions !== 3 || base.rebounds.length !== 3 || !contact || contact.ballId !== source.bank.ballId
    || plan.ballId !== source.bank.ballId || distance(contact.position, base.contact.position) > 1e-9 || Math.abs(contact.time - base.contact.time) > 1e-9
    || Math.hypot(contact.incoming.x, contact.incoming.y) < .05) return null;
  const checkpoints = [...base.rebounds.map(r => r.position), contact.position];
  const indices = checkpoints.map(p => simulation.cueApproachPath.findIndex(v => distance(p, v) < 1e-9));
  if (indices.some((v, i) => v <= (i ? indices[i - 1] : 0)) || base.rebounds.some((r, i) => i > 0 && r.time <= base.rebounds[i - 1].time)) return null;
  const launch = { x: Math.cos(plan.angle), y: Math.sin(plan.angle) }, angle = directionDifference(launch, contact.incoming);
  if (angle < 45) return null;
  const legs = indices.map((end, i) => simulation.cueApproachPath.slice(i ? indices[i - 1] : 0, end + 1));
  return { rebounds: base.rebounds, contact, launch, angle, legs };
}
export function kickFinalPreview(source: Scenario, options: FinishOption[]): KickFinalPreview | null {
  for (const option of options) {
    const simulation = simulateShot(source, option.plan, { record: false, recordPaths: true, recordContacts: true });
    if (kickFinalEvidence(source, option.plan, simulation)) return { referenceId: option.id, simulation };
  }
  return null;
}
