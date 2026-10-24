import { evaluateShotObjective } from './objectives';
import { simulateShot } from './physics';
import { scanToleranceBound } from './tolerance';
import type { FinishOption, Scenario, ShotPlan } from './types';
export function strengthMargins(source: Scenario, plan: ShotPlan) {
  const nominal = simulateShot(source, plan, { record: false });
  const nominalSuccess = evaluateShotObjective(source, plan, nominal).success;
  const sides = ([-1, 1] as const).map(direction => {
    const cap = Math.max(0, Math.min(30, direction < 0 ? (1 - .05 / plan.speed) * 100 : (4 / plan.speed - 1) * 100));
    const probe = (offset: number) => {
      const changed = { ...plan, speed: Math.max(.05, Math.min(4, plan.speed * (1 + direction * offset / 100))) };
      const simulation = simulateShot(source, changed, { record: false, recordPaths: true });
      return { offset: direction * offset, speed: changed.speed, simulation, outcome: evaluateShotObjective(source, plan, simulation) };
    };
    const bound = scanToleranceBound(nominalSuccess, cap, 1, value => probe(value).outcome.success);
    return { direction, value: bound.value, limited: bound.limited,
      passing: probe(bound.value), failing: bound.failing === null ? null : probe(bound.failing) };
  });
  return { nominalSuccess, sides };
}
export function protectedDirection(soft: number, hard: number): 'soft' | 'hard' | 'equal' {
  return Math.abs(soft - hard) <= 1 / 64 ? 'equal' : soft < hard ? 'soft' : 'hard';
}
/** Two nominally successful examples near opposite edges of one offered stroke's
 * sampled speed interval. Geometry only; no scoring ensemble selects examples. */
export function strengthAsymmetryPreview(source: Scenario, options: FinishOption[]) {
  for (const option of options) {
    const base = strengthMargins(source, option.plan);
    if (!base.nominalSuccess || base.sides.some(s => s.limited || s.value < .1)) continue;
    const variants = base.sides.map(side => {
      const plan = { ...option.plan, speed: option.plan.speed * (1 + side.direction * side.value * .9 / 100) };
      return { plan, ...strengthMargins(source, plan) };
    });
    if (variants.every(v => v.nominalSuccess && v.sides.every(s => !s.limited && s.failing && s.passing.outcome.success && !s.failing.outcome.success))
      && protectedDirection(variants[0].sides[0].value, variants[0].sides[1].value) === 'soft'
      && protectedDirection(variants[1].sides[0].value, variants[1].sides[1].value) === 'hard') return { referenceId: option.id, variants };
  }
  return null;
}
export type StrengthAsymmetryPreview = NonNullable<ReturnType<typeof strengthAsymmetryPreview>>;
