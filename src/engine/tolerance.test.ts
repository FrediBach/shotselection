import { afterEach, describe, expect, it, vi } from 'vitest';
import { analyzeShotToleranceAsync } from './client';
import { positionToleranceForLevel } from './constants';
import { distance } from './math';
import * as physics from './physics';
import { analyzeShotTolerance } from './tolerance';
import type { Scenario, ShotPlan, Simulation, ToleranceAxis, TolerancePoint } from './types';

const scenario: Scenario = {
  level: 21, seed: 42, title: 'Straight pot', description: 'Tolerance fixture',
  balls: [{ id: 0, position: { x: 1.27, y: 0.85 } }, { id: 1, position: { x: 1.27, y: 0.3 } }],
};
const plan: ShotPlan = {
  id: 'straight', ballId: 1, pocketId: 1, target: { x: 1.27, y: 0.38 },
  angle: -Math.PI / 2, speed: 1.35, topSpin: 0, sideSpin: 0, label: 'Straight pot',
};
const successful: Simulation = {
  frames: [], finalBalls: [], soundEvents: [], cuePath: [], cueApproachPath: [], objectPath: [], cueEnd: plan.target,
  potted: [1], scratch: false, firstContact: 1, duration: 2, stopped: true,
};
const axes: ToleranceAxis[] = ['angle', 'sideSpin', 'speed'];

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('sampled one-sided stroke tolerances', () => {
  it.each([
    ['wrong first contact', { firstContact: 2 }],
    ['no contact', { firstContact: null }],
    ['missed object ball', { potted: [] }],
    ['scratch', { scratch: true }],
    ['unsettled simulation', { stopped: false }],
  ] as const)('rejects %s for both legal-pot and position success', (_reason, changes) => {
    vi.spyOn(physics, 'simulateShot').mockReturnValue({ ...successful, ...changes, potted: [...('potted' in changes ? changes.potted : successful.potted)] });
    const result = analyzeShotTolerance(scenario, plan);
    expect(result.nominalPot).toBe(false);
    expect(result.nominalSuccess).toBe(false);
    expect(result.volume.potCount).toBe(0);
    expect(result.volume.successCount).toBe(0);
    for (const axis of axes) for (const kind of ['pot', 'success'] as const) {
      expect(result.axes[axis][kind]).toEqual({ negative: { value: 0, limited: false }, positive: { value: 0, limited: false } });
    }
  });

  it('requires the level-specific target radius in addition to a legal pot', () => {
    vi.spyOn(physics, 'simulateShot').mockReturnValue({ ...successful, cueEnd: { x: plan.target.x + 0.12, y: plan.target.y } });
    const easy = analyzeShotTolerance(scenario, plan);
    const hard = analyzeShotTolerance({ ...scenario, level: 80 }, plan);
    expect(easy.nominalSuccess).toBe(true);
    expect(hard.nominalPot).toBe(true);
    expect(hard.nominalSuccess).toBe(false);
    expect(hard.positionTolerance).toBe(0.08);
    expect(hard.volume.potCount).toBe(441);
    expect(hard.volume.successCount).toBe(0);
    expect(hard.axes.angle.pot.negative).toEqual({ value: 2, limited: true });
    expect(hard.axes.angle.success.negative).toEqual({ value: 0, limited: false });
  });

  it('finds asymmetric first failures without including a disconnected success island', () => {
    vi.spyOn(physics, 'simulateShot').mockImplementation((_scenario, trial) => {
      const angle = (trial.angle - plan.angle) * 180 / Math.PI;
      const inFirstRegion = angle >= -0.373 && angle <= 0.823;
      const laterIsland = angle >= 1.2;
      return { ...successful, potted: inFirstRegion || laterIsland ? [1] : [] };
    });
    const result = analyzeShotTolerance(scenario, plan);
    expect(result.axes.angle.success.negative.value).toBeLessThanOrEqual(0.373);
    expect(result.axes.angle.success.negative.value).toBeGreaterThan(0.372);
    expect(result.axes.angle.success.positive.value).toBeLessThanOrEqual(0.823);
    expect(result.axes.angle.success.positive.value).toBeGreaterThan(0.822);
    expect(result.axes.angle.success.positive.limited).toBe(false);
    expect(result.volume.points.some(point => point.angle >= 1.5 && point.success)).toBe(true);
  });

  it('reports independent legal-pot and position boundaries', () => {
    vi.spyOn(physics, 'simulateShot').mockImplementation((_scenario, trial) => {
      const angle = (trial.angle - plan.angle) * 180 / Math.PI;
      return { ...successful, potted: Math.abs(angle) <= 1.1 ? [1] : [], cueEnd: { x: plan.target.x + Math.abs(angle) / 2, y: plan.target.y } };
    });
    const result = analyzeShotTolerance(scenario, plan);
    expect(result.axes.angle.pot.positive.value).toBeCloseTo(1.1, 2);
    expect(result.axes.angle.success.positive.value).toBeCloseTo(positionToleranceForLevel(scenario.level) * 2, 2);
    expect(result.volume.potCount).toBeGreaterThan(result.volume.successCount);
    expect(result.volume.points.every(point => !point.success || point.pot)).toBe(true);
  });

  it('uses degrees, signed english, relative speed and fixed draw/follow without recording replays', () => {
    const stroke = { ...plan, angle: 0.4, sideSpin: 8, topSpin: -0.7, speed: 2 };
    const simulate = vi.spyOn(physics, 'simulateShot').mockReturnValue(successful);
    const result = analyzeShotTolerance(scenario, stroke);
    expect(result.volume.points).toHaveLength(441);
    expect(result.volume.points.every(point => point.available)).toBe(true);
    expect(result.volume.limits).toEqual({ angle: 2, sideSpin: 30, speed: 30 });
    expect(result.volume.steps).toEqual({ angle: 0.5, sideSpin: 10, speed: 10 });
    expect(result.volume.points.filter(point => point.angle === 0 && point.sideSpin === 0 && point.speed === 0)).toHaveLength(1);
    expect(simulate.mock.calls.some(([, trial]) => Math.abs(trial.angle - (stroke.angle - 2 * Math.PI / 180)) < 1e-12 && trial.sideSpin === -22 && trial.speed === 1.4)).toBe(true);
    expect(simulate.mock.calls.some(([, trial]) => Math.abs(trial.angle - (stroke.angle + 2 * Math.PI / 180)) < 1e-12 && trial.sideSpin === 38 && trial.speed === 2.6)).toBe(true);
    for (const [, trial, options] of simulate.mock.calls) {
      expect(trial.topSpin).toBe(stroke.topSpin);
      expect(trial.target).toBe(stroke.target);
      expect(options).toEqual({ record: false });
    }
  });

  it('caps speed at the physical range rather than duplicating clamped samples', () => {
    const simulate = vi.spyOn(physics, 'simulateShot').mockReturnValue(successful);
    const high = analyzeShotTolerance(scenario, { ...plan, speed: 3.6 });
    expect(high.axes.speed.pot.positive.value).toBeCloseTo((4 / 3.6 - 1) * 100, 8);
    expect(high.axes.speed.pot.positive.limited).toBe(true);
    const unavailable = high.volume.points.filter(point => point.speed > 11.12);
    expect(unavailable).toHaveLength(126);
    expect(unavailable.every(point => !point.available && !point.pot && !point.success)).toBe(true);
    expect(high.volume.points.filter(point => point.speed <= 11.12).every(point => point.available)).toBe(true);
    expect(simulate.mock.calls.every(([, trial]) => trial.speed >= 0.05 && trial.speed <= 4)).toBe(true);
    // Only the one-axis cap probe uses 4 m/s. None of the 126 unavailable
    // combinations may silently run again at a clamped launch speed.
    const capCalls = simulate.mock.calls.filter(([, trial]) => trial.speed === 4);
    expect(capCalls).toHaveLength(1);
    expect(capCalls[0][1]).toMatchObject({ angle: plan.angle, sideSpin: plan.sideSpin });
    const low = analyzeShotTolerance(scenario, { ...plan, speed: 0.05 });
    expect(low.axes.speed.success.negative).toEqual({ value: 0, limited: true });
    expect(low.volume.points.filter(point => point.speed < 0).every(point => !point.available && !point.pot && !point.success)).toBe(true);
    expect(simulate.mock.calls.every(([, trial]) => trial.speed >= 0.05 && trial.speed <= 4)).toBe(true);
    expect(() => analyzeShotTolerance(scenario, { ...plan, speed: 0 })).toThrow(/speed/);
    expect(() => analyzeShotTolerance(scenario, { ...plan, angle: NaN })).toThrow(/finite/);
  });
});

describe('physical tolerance samples', () => {
  it('reproduces real simultaneous perturbations and brackets a real pocket boundary', () => {
    const nominal = physics.simulateShot(scenario, plan, { record: false });
    const stroke = { ...plan, target: nominal.cueEnd };
    const result = analyzeShotTolerance(scenario, stroke);
    expect(result.nominalPot).toBe(true);
    expect(result.nominalSuccess).toBe(true);
    expect(result.volume.points.every(point => point.available)).toBe(true);
    expect(result.volume.successCount).toBeGreaterThan(0);
    expect(result.volume.successCount).toBeLessThan(result.volume.points.length);
    expect(result.volume.potCount).toBe(result.volume.points.filter(point => point.pot).length);
    expect(result.volume.successCount).toBe(result.volume.points.filter(point => point.success).length);
    const actualOutcome = (point: Pick<TolerancePoint, 'angle' | 'sideSpin' | 'speed'>) => {
      const trial = physics.simulateShot(scenario, { ...stroke, angle: stroke.angle + point.angle * Math.PI / 180, sideSpin: stroke.sideSpin + point.sideSpin, speed: stroke.speed * (1 + point.speed / 100) }, { record: false });
      const pot = trial.stopped && !trial.scratch && trial.firstContact === stroke.ballId && trial.potted.includes(stroke.ballId);
      return { pot, success: pot && distance(trial.cueEnd, stroke.target) <= positionToleranceForLevel(scenario.level) };
    };
    for (const index of [0, 32, 137, 220, 309, 402, 440]) {
      const point = result.volume.points[index];
      expect(actualOutcome(point)).toEqual({ pot: point.pot, success: point.success });
    }
    for (const direction of [-1, 1]) {
      const bound = result.axes.angle.pot[direction < 0 ? 'negative' : 'positive'];
      expect(bound.limited).toBe(false);
      expect(bound.value).toBeGreaterThan(0);
      expect(actualOutcome({ angle: direction * bound.value, sideSpin: 0, speed: 0 }).pot).toBe(true);
      expect(actualOutcome({ angle: direction * (bound.value + 0.001), sideSpin: 0, speed: 0 }).pot).toBe(false);
    }
    expect(analyzeShotTolerance(scenario, stroke)).toEqual(result);
  }, 20000);
});

describe('tolerance worker client', () => {
  class TestWorker {
    static instances: TestWorker[] = [];
    onmessage?: (event: { data: unknown }) => void;
    onerror?: (event: { message: string }) => void;
    postMessage = vi.fn();
    terminate = vi.fn();
    constructor() { TestWorker.instances.push(this); }
  }

  it('sends a separate tolerance request and terminates after receiving its result', async () => {
    TestWorker.instances = [];
    vi.stubGlobal('Worker', TestWorker);
    const pending = analyzeShotToleranceAsync(scenario, plan);
    const worker = TestWorker.instances[0];
    expect(worker.postMessage).toHaveBeenCalledWith({ method: 'tolerance', scenario, plan });
    worker.onmessage?.({ data: { result: { planId: plan.id } } });
    await expect(pending).resolves.toEqual({ planId: plan.id });
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it('cancels the worker and rejects stale analysis when its abort signal fires', async () => {
    TestWorker.instances = [];
    vi.stubGlobal('Worker', TestWorker);
    const controller = new AbortController();
    const pending = analyzeShotToleranceAsync(scenario, plan, { signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(TestWorker.instances[0].terminate).toHaveBeenCalledOnce();
    await expect(analyzeShotToleranceAsync(scenario, plan, { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
    expect(TestWorker.instances).toHaveLength(1);
  });
});
