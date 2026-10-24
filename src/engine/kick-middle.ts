import { distance } from './math';
import { pathClearance } from './return-lane';
import { kickSequenceEvidence } from './kick-sequence';
import { bankPlanForStroke, bankRoutesFor } from './bank-routes';
import { simulateShot } from './physics';
import { POCKET_GEOMETRY } from './table-geometry';
import type { FinishOption, Scenario, ShotPlan, Simulation } from './types';
export interface KickMiddleExperiment {
  referenceId: string; reference: Simulation; referenceOpen: Simulation;
  blockedPlan: ShotPlan; intended: Simulation; blocked: Simulation;
}
export const withoutMiddleBlocker = (source: Scenario): Scenario => ({ ...source, balls: source.balls.filter(b => b.id !== 10) });
export function kickMiddleEvidence(source: Scenario, plan: ShotPlan, x: KickMiddleExperiment) {
  const blocker = source.balls.find(b => b.id === 10), open = withoutMiddleBlocker(source);
  const reference = kickSequenceEvidence(source, x.reference), referenceOpen = kickSequenceEvidence(open, x.referenceOpen);
  const intended = kickSequenceEvidence(open, x.intended), contact = x.blocked.firstImpact, rebound = x.blocked.cueRebounds?.[0];
  if (!blocker || !reference || !referenceOpen || !intended || !contact || !rebound
    || plan.ballId !== 1 || x.blockedPlan.ballId !== 1 || plan.pocketId !== x.blockedPlan.pocketId
    || !x.blocked.stopped || x.blocked.scratch || x.blocked.potted.includes(1) || x.blocked.firstContact !== 10 || contact.ballId !== 10
    || x.blocked.cueBanksBeforeContact !== 1 || !rebound.beforeContact || contact.time <= rebound.time || contact.time >= intended.second.time
    || distance(contact.position, rebound.position) < .06 || distance(contact.position, intended.second.position) < .06
    || distance(rebound.position, intended.first.position) > 1e-9 || Math.abs(rebound.time - intended.first.time) > 1e-9
    || JSON.stringify(x.reference.cueApproachPath) !== JSON.stringify(x.referenceOpen.cueApproachPath)) return null;
  const pocket = POCKET_GEOMETRY.find(p => p.id === plan.pocketId);
  if (!pocket || [x.reference, x.referenceOpen, x.intended].some(s => s.objectCushions !== 0 || !s.objectPath.length || distance(s.objectPath.at(-1)!, pocket.center) > .08)) return null;
  const gaps = intended.legs.map(l => pathClearance(blocker.position, l)), clearGaps = reference.legs.map(l => pathClearance(blocker.position, l));
  if (gaps[0] < .02 || gaps[1] > -.008 || gaps[2] < .02 || clearGaps.some(g => g < .01)) return null;
  const index = x.blocked.cueApproachPath.findIndex(p => distance(p, rebound.position) < 1e-9);
  if (index < 1) return null;
  return { reference, referenceOpen, intended, contact, rebound, gaps, clearGaps,
    blockedLegs: [x.blocked.cueApproachPath.slice(0, index + 1), [...x.blocked.cueApproachPath.slice(index), contact.position]] };
}
export function kickMiddleExperiment(source: Scenario, options: FinishOption[]): KickMiddleExperiment | null {
  const blocker = source.balls.find(b => b.id === 10); if (!blocker) return null;
  const open = withoutMiddleBlocker(source);
  const references = options.flatMap(option => {
    const reference = simulateShot(source, option.plan, { record: false, recordPaths: true }), e = kickSequenceEvidence(source, reference);
    if (!e || e.legs.some(l => pathClearance(blocker.position, l) < .01)) return [];
    return [{ option, reference, referenceOpen: simulateShot(open, option.plan, { record: false, recordPaths: true }) }];
  });
  for (const route of bankRoutesFor(open, 1).filter(r => references.some(c => c.option.plan.pocketId === r.pocketId)))
    for (const speed of [1.95, 2.35, 2.8, 3.3]) for (const topSpin of [1.6, 1.05, -1.1, 0]) {
      const blockedPlan = bankPlanForStroke(open, route, speed, topSpin); if (!blockedPlan) continue;
      const intended = simulateShot(open, blockedPlan, { record: false, recordPaths: true }), e = kickSequenceEvidence(open, intended);
      if (!e || pathClearance(blocker.position, e.legs[1]) > -.008) continue;
      const blocked = simulateShot(source, blockedPlan, { record: false, recordPaths: true });
      for (const candidate of references.filter(c => c.option.plan.pocketId === blockedPlan.pocketId)) {
        const x = { referenceId: candidate.option.id, reference: candidate.reference, referenceOpen: candidate.referenceOpen, blockedPlan, intended, blocked };
        if (kickMiddleEvidence(source, candidate.option.plan, x)) return x;
      }
    }
  return null;
}
