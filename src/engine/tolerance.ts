import { positionToleranceForLevel } from './constants';
import { distance } from './math';
import { simulateShot } from './physics';
import type { AxisTolerance, Scenario, ShotPlan, ShotTolerance, ToleranceAxis, ToleranceBound, TolerancePoint } from './types';

// Keep the volume identical across shots so a larger sampled share has meaning.
// This uniform grid is a sensitivity study, not the random-error ensemble used
// for scoring and not a probability distribution for a player's stroke.
const LIMITS = { angle: 2, sideSpin: 30, speed: 30 } as const;
const GRID_STEPS = { angle: 0.5, sideSpin: 10, speed: 10 } as const;
const SCAN_STEPS = { angle: 0.05, sideSpin: 1, speed: 1 } as const;
const AXES: ToleranceAxis[] = ['angle', 'sideSpin', 'speed'];
const MIN_SPEED = 0.05;
const MAX_SPEED = 4;
const REFINEMENTS = 6;

interface Outcome { available: boolean; pot: boolean; success: boolean }

/** Sample margins around the exact offered stroke, holding draw/follow fixed.
 * Each margin ends at the first observed failure moving away from zero. A later
 * successful island never widens that margin. Finite steps may miss small gaps:
 * these are sampled estimates, not a proof that every interior stroke succeeds.
 */
export function analyzeShotTolerance(scenario: Scenario, plan: ShotPlan): ShotTolerance {
  if (![plan.angle, plan.sideSpin, plan.topSpin, plan.speed, plan.target.x, plan.target.y].every(Number.isFinite)
    || plan.speed < MIN_SPEED || plan.speed > MAX_SPEED) {
    throw new Error('Tolerance analysis needs a finite stroke with speed between 0.05 and 4 m/s.');
  }
  const positionTolerance = positionToleranceForLevel(scenario.level);
  const cache = new Map<string, Outcome>();
  const evaluate = (angle: number, sideSpin: number, speed: number): Outcome => {
    // Fixed decimal keys share nominal and axis-grid probes despite arithmetic
    // rounding in percentage caps and repeated bisections.
    const key = [angle, sideSpin, speed].map(value => value.toFixed(9)).join(',');
    const cached = cache.get(key);
    if (cached) return cached;
    const cueSpeed = plan.speed * (1 + speed / 100);
    // simulateShot clamps speed. Do not count unreachable requested strokes as
    // identical successful samples at 4 m/s or at the minimum speed.
    if (cueSpeed < MIN_SPEED - 1e-12 || cueSpeed > MAX_SPEED + 1e-12) {
      const unavailable = { available: false, pot: false, success: false };
      cache.set(key, unavailable);
      return unavailable;
    }
    const simulation = simulateShot(scenario, {
      ...plan,
      angle: plan.angle + angle * Math.PI / 180,
      sideSpin: plan.sideSpin + sideSpin,
      speed: Math.max(MIN_SPEED, Math.min(MAX_SPEED, cueSpeed)),
    }, { record: false });
    const pot = simulation.stopped && !simulation.scratch
      && simulation.firstContact === plan.ballId && simulation.potted.includes(plan.ballId);
    const outcome = { available: true, pot, success: pot && distance(simulation.cueEnd, plan.target) <= positionTolerance };
    cache.set(key, outcome);
    return outcome;
  };
  const nominal = evaluate(0, 0, 0);
  const evaluateAxis = (axis: ToleranceAxis, value: number): Outcome => evaluate(
    axis === 'angle' ? value : 0,
    axis === 'sideSpin' ? value : 0,
    axis === 'speed' ? value : 0,
  );
  const searchBound = (axis: ToleranceAxis, direction: -1 | 1, criterion: 'pot' | 'success'): ToleranceBound => {
    if (!nominal[criterion]) return { value: 0, limited: false };
    const physicalCap = axis === 'speed'
      ? direction === -1 ? (1 - MIN_SPEED / plan.speed) * 100 : (MAX_SPEED / plan.speed - 1) * 100
      : Infinity;
    const cap = Math.max(0, Math.min(LIMITS[axis], physicalCap));
    const count = Math.ceil(cap / SCAN_STEPS[axis]);
    let passing = 0;
    for (let index = 1; index <= count; index++) {
      const next = Math.min(index * SCAN_STEPS[axis], cap);
      if (evaluateAxis(axis, direction * next)[criterion]) {
        passing = next;
        continue;
      }
      // Only refine this adjacent pass/fail bracket, never a wider interval that
      // could jump over an observed failure into a disconnected passing region.
      let failing = next;
      for (let iteration = 0; iteration < REFINEMENTS; iteration++) {
        const midpoint = (passing + failing) / 2;
        if (evaluateAxis(axis, direction * midpoint)[criterion]) passing = midpoint;
        else failing = midpoint;
      }
      return { value: passing, limited: false };
    }
    return { value: cap, limited: true };
  };
  const axisTolerance = (axis: ToleranceAxis): AxisTolerance => ({
    pot: { negative: searchBound(axis, -1, 'pot'), positive: searchBound(axis, 1, 'pot') },
    success: { negative: searchBound(axis, -1, 'success'), positive: searchBound(axis, 1, 'success') },
  });
  const axes = Object.fromEntries(AXES.map(axis => [axis, axisTolerance(axis)])) as Record<ToleranceAxis, AxisTolerance>;
  const points: TolerancePoint[] = [];
  let successCount = 0;
  let potCount = 0;
  // Integer grid indexes guarantee one exact nominal sample and reproducibility.
  for (let angleIndex = -4; angleIndex <= 4; angleIndex++) {
    for (let spinIndex = -3; spinIndex <= 3; spinIndex++) {
      for (let speedIndex = -3; speedIndex <= 3; speedIndex++) {
        const angle = angleIndex * GRID_STEPS.angle;
        const sideSpin = spinIndex * GRID_STEPS.sideSpin;
        const speed = speedIndex * GRID_STEPS.speed;
        const outcome = evaluate(angle, sideSpin, speed);
        points.push({ angle, sideSpin, speed, ...outcome });
        if (outcome.success) successCount++;
        if (outcome.pot) potCount++;
      }
    }
  }
  return {
    planId: plan.id,
    nominalPot: nominal.pot,
    nominalSuccess: nominal.success,
    positionTolerance,
    axes,
    volume: { points, limits: { ...LIMITS }, steps: { ...GRID_STEPS }, successCount, potCount },
  };
}
