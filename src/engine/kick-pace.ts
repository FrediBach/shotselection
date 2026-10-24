import { TABLE } from './constants';
import { distance, dot, normalize, subtract } from './math';
import { kickIntroductionEvidence } from './kick-introduction';
import { simulateShot } from './physics';
import { cueStroke } from './table-conditions';
import type { FinishOption, Scenario, ShotPlan, Simulation } from './types';

export interface KickPaceExperiment {
  referenceId: string; multiplier: number; reference: Simulation; weakPlan: ShotPlan; weak: Simulation;
}
export const reboundSpeed = (v: { x: number; y: number }) => Math.hypot(v.x, v.y);

/** Hold angular velocity fixed: topSpin is a ratio to launch rolling speed. */
export function slowerKickPlan(source: Scenario, plan: ShotPlan, multiplier: number): ShotPlan {
  const speed = plan.speed * multiplier;
  const original = cueStroke(plan, source.conditions), reduced = cueStroke({ ...plan, speed }, source.conditions);
  return { ...plan, speed, topSpin: plan.topSpin * original.speed / reduced.speed };
}

export function kickPaceEvidence(source: Scenario, plan: ShotPlan, reference: Simulation, weakPlan: ShotPlan, weak: Simulation) {
  const good = kickIntroductionEvidence(source, reference), target = source.balls.find(b => b.id === plan.ballId);
  const rebounds = weak.cueRebounds ?? [], rebound = rebounds[0];
  const original = cueStroke(plan, source.conditions), reduced = cueStroke(weakPlan, source.conditions);
  if (!good || good.rebounds.length !== 1 || !target || !weak.stopped || weak.scratch || weak.firstContact !== null
    || weak.potted.length || weak.firstImpact || weak.ballContacts?.length || rebounds.length !== 1 || !rebound.beforeContact
    || weak.cueBanksBeforeContact !== 1 || reduced.speed >= original.speed
    || JSON.stringify({ ...weakPlan, speed: plan.speed, topSpin: plan.topSpin }) !== JSON.stringify(plan)
    || Math.abs(original.speed * original.topSpin - reduced.speed * reduced.topSpin) > 1e-9
    || distance(rebound.position, good.first.position) > .03) return null;
  // Require the weaker route to travel toward the target, then stop well before it,
  // without passing alongside it or moving any object ball.
  const axis = normalize(subtract(target.position, rebound.position));
  const length = distance(target.position, rebound.position);
  const travel = dot(subtract(weak.cueEnd, rebound.position), axis);
  const index = weak.cuePath.findIndex(p => distance(p, rebound.position) < 1e-9);
  if (index < 1 || travel < .1 || travel > length - .15
    || weak.cuePath.slice(index).some(p => dot(subtract(p, rebound.position), axis) > length - .1)
    || dot(normalize(rebound.outgoing), normalize(good.first.outgoing)) < Math.cos(5 * Math.PI / 180)
    || source.balls.some(b => b.id !== 0 && (!weak.finalBalls.some(f => f.id === b.id && !f.pocketed && distance(f.position, b.position) < 1e-9)))) return null;
  for (const r of [good.first, rebound]) if (reboundSpeed(r.incoming) - reboundSpeed(r.outgoing) < .01) return null;
  return { good: good.first, weak: rebound, shortfall: length - travel,
    gap: distance(weak.cueEnd, target.position) - TABLE.ballDiameter,
    incoming: weak.cuePath.slice(0, index + 1), outgoing: weak.cuePath.slice(index) };
}

export function kickPaceExperiment(source: Scenario, options: FinishOption[]): KickPaceExperiment | null {
  for (const option of options) {
    const reference = simulateShot(source, option.plan, { record: false, recordPaths: true });
    if (!kickIntroductionEvidence(source, reference)) continue;
    for (const multiplier of [.95, .9, .85, .8, .75, .7, .65, .6, .55, .5]) {
      const weakPlan = slowerKickPlan(source, option.plan, multiplier);
      const weak = simulateShot(source, weakPlan, { record: false, recordPaths: true });
      if (kickPaceEvidence(source, option.plan, reference, weakPlan, weak))
        return { referenceId: option.id, multiplier, reference, weakPlan, weak };
    }
  }
  return null;
}
