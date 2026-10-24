import { signedAngleEvidence } from './signed-angle';
import { distance, dot, normalize, subtract } from './math';
import type { Scenario, Simulation } from './types';

export function angleTravelEvidence(source: Scenario, first: Simulation, second: Simulation, pocketId: number) {
  const angle = signedAngleEvidence(source, first, pocketId);
  const impact = second.firstImpact;
  if (!angle || !impact || !second.stopped || second.scratch) return null;
  return { ...angle, travel: distance(impact.position, second.cueEnd), start: impact.position,
    end: second.cueEnd, incomingSpeed: impact.cueSpeedBefore,
    rollRatio: impact.cueRollSpeedBefore === undefined ? null : impact.cueRollSpeedBefore / impact.cueSpeedBefore };
}

/** Same useful side, similar contact state, and an uninterrupted departure toward
 * the shared third-shot setup. Travel is measured from actual first contact. */
export function isAngleTravelContrast(source: Scenario, firstFull: Simulation, firstThin: Simulation, secondFull: Simulation, secondThin: Simulation, pocketId: number) {
  const full = angleTravelEvidence(source, firstFull, secondFull, pocketId);
  const thin = angleTravelEvidence(source, firstThin, secondThin, pocketId);
  if (!full || !thin || full.angle * thin.angle <= 0 || Math.abs(thin.angle) < Math.abs(full.angle) + 8
    || thin.travel < full.travel + .12 || full.travel < .025
    || Math.max(full.incomingSpeed, thin.incomingSpeed) / Math.min(full.incomingSpeed, thin.incomingSpeed) > 1.1
    || full.rollRatio === null || thin.rollRatio === null || Math.abs(full.rollRatio - thin.rollRatio) > .15) return false;
  if ([secondFull, secondThin].some(s => s.cueRebounds?.length || s.ballContacts?.length !== 1)) return false;
  return [full, thin].every(e => dot(normalize(subtract(e.end, e.start)), normalize(subtract(thin.end, e.start))) > .9);
}
