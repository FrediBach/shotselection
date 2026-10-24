import { bankPlanForStroke, bankRoutesFor } from './bank-routes';
import { directionDifference } from './kick-spin';
import { distance } from './math';
import { simulateShot } from './physics';
import { POCKET_GEOMETRY } from './table-geometry';
import type { FinishOption, Scenario, ShotPlan, Simulation } from './types';

export interface KickFinishExperiment { referenceId: string; reference: Simulation; scratchPlan: ShotPlan; scratched: Simulation }
export function kickFinishPath(s: Simulation) {
  const contact = s.cueContacts?.[0], rebounds = s.cueRebounds?.filter(r => r.beforeContact);
  if (!contact || contact.ballId !== 1 || s.cueContacts?.length !== 1 || rebounds?.length !== 1 || s.cueBanksBeforeContact !== 1
    || contact.time <= rebounds[0].time || !s.stopped || s.firstContact !== 1 || !s.potted.includes(1) || s.objectCushions !== 0) return null;
  const rebound = rebounds[0], i = s.cueApproachPath.findIndex(p => distance(p, rebound.position) < 1e-9);
  const j = s.cuePath.findIndex(p => distance(p, contact.position) < 1e-9);
  if (i < 1 || j < 1 || j >= s.cuePath.length - 1) return null;
  return { contact, rebound, approach: [...s.cueApproachPath.slice(i), contact.position], departure: s.cuePath.slice(j) };
}
export function kickFinishEvidence(source: Scenario, plan: ShotPlan, x: KickFinishExperiment) {
  const reference = kickFinishPath(x.reference), scratched = kickFinishPath(x.scratched);
  const pocket = POCKET_GEOMETRY.find(p => p.id === plan.pocketId);
  if (!reference || !scratched || !pocket || source.bank?.ballId !== 1 || plan.ballId !== 1 || x.scratchPlan.ballId !== 1
    || x.scratchPlan.pocketId !== plan.pocketId || x.reference.scratch || !x.scratched.scratch
    || [x.reference, x.scratched].some(s => !s.objectPath.length || distance(s.objectPath.at(-1)!, pocket.center) > .08)) return null;
  const approachAngle = directionDifference(reference.contact.incoming, scratched.contact.incoming);
  const launchAngle = directionDifference({ x: Math.cos(x.scratchPlan.angle), y: Math.sin(x.scratchPlan.angle) }, scratched.contact.incoming);
  if (approachAngle < 10 || launchAngle < 90 || distance(x.scratched.cueEnd, pocket.center) > .08) return null;
  return { reference, scratched, approachAngle, launchAngle, pocket };
}
export function kickFinishExperiment(source: Scenario, options: FinishOption[]): KickFinishExperiment | null {
  const routes = bankRoutesFor(source, 1).filter(r => r.sides.length === 1);
  for (const option of options) {
    const reference = simulateShot(source, option.plan, { record: false, recordPaths: true, recordContacts: true });
    if (!kickFinishPath(reference) || reference.scratch) continue;
    for (const route of routes.filter(r => r.pocketId === option.plan.pocketId))
      for (const speed of [2.8, 2.35, 3.3, 1.95]) for (const topSpin of [-1.1, -1.6, 0, 1.05, 1.6]) {
        const scratchPlan = bankPlanForStroke(source, route, speed, topSpin);
        if (!scratchPlan) continue;
        const scratched = simulateShot(source, scratchPlan, { record: false, recordPaths: true, recordContacts: true });
        const experiment = { referenceId: option.id, reference, scratchPlan, scratched };
        if (kickFinishEvidence(source, option.plan, experiment)) return experiment;
      }
  }
  return null;
}
