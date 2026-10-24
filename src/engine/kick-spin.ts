import { TABLE } from './constants';
import { clamp, distance, dot, normalize, subtract } from './math';
import { kickIntroductionEvidence } from './kick-introduction';
import { bankPlanForStroke, bankRoutesFor } from './bank-routes';
import { simulateShot } from './physics';
import { POCKET_GEOMETRY } from './table-geometry';
import type { FinishOption, Scenario, ShotPlan, Simulation, Vec2 } from './types';

export interface KickSpinExperiment {
  referenceId: string; reference: Simulation; spinPlan: ShotPlan; spinOnly: Simulation; correctedPlan: ShotPlan; corrected: Simulation;
}
export const directionDifference = (a: Vec2, b: Vec2) => Math.acos(clamp(dot(normalize(a), normalize(b)), -1, 1)) * 180 / Math.PI;
const rail = (p: Vec2) => {
  const gaps = [Math.abs(p.x - TABLE.ballRadius), Math.abs(p.x - TABLE.length + TABLE.ballRadius), Math.abs(p.y - TABLE.ballRadius), Math.abs(p.y - TABLE.width + TABLE.ballRadius)];
  return gaps.indexOf(Math.min(...gaps));
};

/** Measured first 20 cm after R1, ending before another cushion or object contact. */
export function kickExitSegment(simulation: Simulation) {
  const rebound = simulation.cueRebounds?.[0];
  if (!rebound?.beforeContact) return null;
  const index = simulation.cueApproachPath.findIndex(p => distance(p, rebound.position) < 1e-9);
  if (index < 1) return null;
  const path = [rebound.position]; let length = 0;
  for (const point of simulation.cueApproachPath.slice(index + 1)) {
    if (simulation.cueRebounds!.slice(1).some(r => distance(r.position, point) < 1e-9)) return null;
    const previous = path.at(-1)!, step = distance(previous, point);
    if (length + step >= .2) {
      const ratio = (.2 - length) / step;
      const end = { x: previous.x + (point.x - previous.x) * ratio, y: previous.y + (point.y - previous.y) * ratio };
      path.push(end);
      return { rebound, path, direction: subtract(end, rebound.position) };
    }
    path.push(point); length += step;
  }
  return null;
}

export function kickSpinEvidence(source: Scenario, plan: ShotPlan, x: KickSpinExperiment) {
  const a = kickIntroductionEvidence(source, x.reference), c = kickIntroductionEvidence(source, x.corrected);
  const exits = [x.reference, x.spinOnly, x.corrected].map(kickExitSegment);
  if (!a || !c || exits.some(e => !e) || a.rebounds.length !== 1 || c.rebounds.length !== 1
    || plan.ballId !== source.bank?.ballId || plan.sideSpin !== 0 || plan.topSpin * x.spinPlan.topSpin >= 0
    || JSON.stringify({ ...x.spinPlan, topSpin: plan.topSpin }) !== JSON.stringify(plan)
    || JSON.stringify({ ...x.correctedPlan, angle: x.spinPlan.angle }) !== JSON.stringify(x.spinPlan)
    || !x.spinOnly.stopped || x.spinOnly.scratch || x.spinOnly.potted.length
    || (x.spinOnly.firstContact !== null && x.spinOnly.firstContact !== plan.ballId)) return null;
  const [reference, spinOnly, corrected] = exits as [NonNullable<typeof exits[0]>, NonNullable<typeof exits[0]>, NonNullable<typeof exits[0]>];
  const shift = distance(reference.rebound.position, corrected.rebound.position);
  const immediateAngle = directionDifference(reference.rebound.outgoing, spinOnly.rebound.outgoing);
  const exitAngle = directionDifference(reference.direction, spinOnly.direction);
  const aimChange = Math.abs(Math.atan2(Math.sin(x.correctedPlan.angle - plan.angle), Math.cos(x.correctedPlan.angle - plan.angle))) * 180 / Math.PI;
  const pocket = POCKET_GEOMETRY.find(p => p.id === plan.pocketId);
  if (!pocket || [x.reference, x.corrected].some(s => s.objectCushions !== 0 || !s.objectPath.length || distance(s.objectPath.at(-1)!, pocket.center) > .08)
    || distance(reference.rebound.position, spinOnly.rebound.position) > .003
    || immediateAngle > .1 || exitAngle < 3 || shift < .02 || aimChange < 1 || aimChange > 25
    || rail(reference.rebound.position) !== rail(corrected.rebound.position)) return null;
  return { reference, spinOnly, corrected, shift, immediateAngle, exitAngle, aimChange };
}

export function kickSpinExperiment(source: Scenario, options: FinishOption[]): KickSpinExperiment | null {
  const routes = bankRoutesFor(source, source.bank!.ballId).filter(r => r.sides.length === 1);
  for (const option of options) {
    if (!option.plan.topSpin || option.plan.sideSpin) continue;
    const reference = simulateShot(source, option.plan, { record: false, recordPaths: true });
    for (const topSpin of option.plan.topSpin < 0 ? [1.05, 1.6] : [-1.1, -1.6]) {
      const spinPlan = { ...option.plan, topSpin };
      const spinOnly = simulateShot(source, spinPlan, { record: false, recordPaths: true });
      if (!spinOnly.stopped || spinOnly.scratch || spinOnly.potted.length || (spinOnly.firstContact !== null && spinOnly.firstContact !== option.plan.ballId)) continue;
      for (const route of routes.filter(r => r.pocketId === option.plan.pocketId)) {
        const calibrated = bankPlanForStroke(source, route, option.plan.speed, topSpin);
        if (!calibrated) continue;
        // Refine the physical contact around the ghost-ball seed to avoid a jaw-assisted pot.
        const offsets = [0, ...Array.from({ length: 12 }, (_, i) => [(i + 1) * .0005, -(i + 1) * .0005]).flat()];
        for (const offset of offsets) {
          const correctedPlan = { ...spinPlan, angle: calibrated.angle + offset };
          const corrected = simulateShot(source, correctedPlan, { record: false, recordPaths: true });
          const experiment = { referenceId: option.id, reference, spinPlan, spinOnly, correctedPlan, corrected };
          if (kickSpinEvidence(source, option.plan, experiment)) return experiment;
        }
      }
    }
  }
  return null;
}
