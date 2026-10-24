import { distance } from './math';
import { pathClearance } from './return-lane';
import { kickIntroductionEvidence } from './kick-introduction';
import { bankPlanForStroke, bankRoutesFor } from './bank-routes';
import { simulateShot } from './physics';
import { POCKET_GEOMETRY } from './table-geometry';
import type { FinishOption, Scenario, ShotPlan, Simulation } from './types';

export interface KickCorridorExperiment {
  referenceId: string; reference: Simulation; referenceOpen: Simulation;
  blockedPlan: ShotPlan; intended: Simulation; blocked: Simulation;
}
export const withoutKickBlocker = (source: Scenario): Scenario => ({ ...source, balls: source.balls.filter(b => b.id !== 3) });

export function kickCorridorEvidence(source: Scenario, plan: ShotPlan, x: KickCorridorExperiment) {
  const blocker = source.balls.find(b => b.id === 3), open = withoutKickBlocker(source);
  const reference = kickIntroductionEvidence(source, x.reference), referenceOpen = kickIntroductionEvidence(open, x.referenceOpen);
  const intended = kickIntroductionEvidence(open, x.intended), contact = x.blocked.firstImpact;
  const rebound = x.blocked.cueRebounds?.[0];
  if (!blocker || !reference || !referenceOpen || !intended || !contact || !rebound
    || plan.ballId !== 1 || source.bank?.ballId !== 1 || x.blockedPlan.ballId !== 1 || x.blockedPlan.pocketId !== plan.pocketId
    || [reference, referenceOpen, intended].some(e => e.rebounds.length !== 1)
    || !x.blocked.stopped || x.blocked.scratch || x.blocked.potted.includes(1)
    || x.blocked.firstContact !== 3 || contact.ballId !== 3 || !rebound.beforeContact
    || x.blocked.cueBanksBeforeContact !== 1 || contact.time <= rebound.time
    || distance(contact.position, rebound.position) < .1
    || distance(rebound.position, intended.first.position) > 1e-9 || Math.abs(rebound.time - intended.first.time) > 1e-9
    || x.reference.cueApproachPath.length !== x.referenceOpen.cueApproachPath.length
    || x.reference.cueApproachPath.some((p, i) => distance(p, x.referenceOpen.cueApproachPath[i]) > 1e-9)) return null;
  const pocket = POCKET_GEOMETRY.find(p => p.id === plan.pocketId);
  if (!pocket || [x.reference, x.referenceOpen, x.intended].some(s => !s.objectPath.length || s.objectCushions !== 0 || distance(s.objectPath.at(-1)!, pocket.center) > .08)) return null;
  const incomingClearance = pathClearance(blocker.position, intended.incoming);
  const outgoingClearance = pathClearance(blocker.position, intended.outgoing);
  const clearIncoming = pathClearance(blocker.position, reference.incoming), clearOutgoing = pathClearance(blocker.position, reference.outgoing);
  const index = x.blocked.cueApproachPath.findIndex(p => distance(p, rebound.position) < 1e-9);
  if (index < 1 || incomingClearance < .03 || outgoingClearance > -.005 || clearIncoming < .03 || clearOutgoing < .03) return null;
  return { reference, referenceOpen, intended, contact, rebound, incomingClearance, outgoingClearance, clearIncoming, clearOutgoing,
    blockedIncoming: x.blocked.cueApproachPath.slice(0, index + 1),
    blockedOutgoing: [...x.blocked.cueApproachPath.slice(index), contact.position] };
}

export function kickCorridorExperiment(source: Scenario, options: FinishOption[]): KickCorridorExperiment | null {
  const blocker = source.balls.find(b => b.id === 3);
  if (!blocker) return null;
  const open = withoutKickBlocker(source);
  const references = options.flatMap(option => {
    const reference = simulateShot(source, option.plan, { record: false, recordPaths: true });
    const e = kickIntroductionEvidence(source, reference);
    if (!e || e.rebounds.length !== 1 || pathClearance(blocker.position, e.incoming) < .03 || pathClearance(blocker.position, e.outgoing) < .03) return [];
    return [{ option, reference, referenceOpen: simulateShot(open, option.plan, { record: false, recordPaths: true }) }];
  });
  for (const route of bankRoutesFor(open, 1).filter(r => r.sides.length === 1 && references.some(c => c.option.plan.pocketId === r.pocketId))) {
    for (const speed of [1.2, 1.6, 1.95, 2.35, 2.8, 3.3]) for (const topSpin of [-1.1, 0, 1.05, 1.6]) {
      const blockedPlan = bankPlanForStroke(open, route, speed, topSpin);
      if (!blockedPlan) continue;
      const intended = simulateShot(open, blockedPlan, { record: false, recordPaths: true });
      const e = kickIntroductionEvidence(open, intended);
      if (!e || e.rebounds.length !== 1 || pathClearance(blocker.position, e.incoming) < .03 || pathClearance(blocker.position, e.outgoing) > -.005) continue;
      const blocked = simulateShot(source, blockedPlan, { record: false, recordPaths: true });
      for (const candidate of references.filter(c => c.option.plan.pocketId === blockedPlan.pocketId)) {
        const experiment = { referenceId: candidate.option.id, reference: candidate.reference, referenceOpen: candidate.referenceOpen, blockedPlan, intended, blocked };
        if (kickCorridorEvidence(source, candidate.option.plan, experiment)) return experiment;
      }
    }
  }
  return null;
}
