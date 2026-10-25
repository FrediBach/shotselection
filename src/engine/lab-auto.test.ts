import { describe, expect, it } from 'vitest';
import { createLabScenario, createLabShot, DEFAULT_LAB_SHOT_SETTINGS } from './lab';
import type { LabShotSettings } from './lab';
import { fitLabShot, MAX_LAB_AUTO_ATTEMPTS } from './lab-auto';
import type { LabAutoRequest, LabAutoResult, LabShotLocks } from './lab-auto';
import { simulateShot } from './physics';

const allLocks: LabShotLocks = { ballId: true, pocketId: true, speed: true, topSpin: true, sideSpin: true, aimOffset: true };
const request = (patch: Partial<LabShotSettings> = {}, locks: LabShotLocks = {}): LabAutoRequest => ({
  scenario: createLabScenario(), locks,
  variant: { id: 'auto', label: 'Auto option', settings: { ...DEFAULT_LAB_SHOT_SETTINGS, ...patch } },
});

function expectPlayable(source: LabAutoRequest, result: LabAutoResult) {
  expect(result.status).toBe('found');
  const simulation = simulateShot(source.scenario, createLabShot(source.scenario, result.settings, 'check', 'Check'), { record: false });
  expect(simulation.firstContact).toBe(result.settings.ballId);
  expect(simulation.pocketEvents).toContainEqual(expect.objectContaining({ ballId: result.settings.ballId, pocketId: result.settings.pocketId }));
  expect(simulation.scratch).toBe(false);
  expect(simulation.stopped).toBe(true);
  for (const key of Object.keys(source.locks) as (keyof LabShotSettings)[]) {
    if (source.locks[key]) expect(result.settings[key]).toBe(source.variant.settings[key]);
  }
  expect(result.attempts).toBeLessThanOrEqual(MAX_LAB_AUTO_ATTEMPTS);
}

describe('lab auto fitting', () => {
  it('keeps a playable physical shot unchanged, including all locked fields', () => {
    const source = request({}, allLocks);
    const result = fitLabShot(source);
    expectPlayable(source, result);
    expect(result.settings).toEqual(source.variant.settings);
    expect(result.changed).toEqual([]);
    expect(result.attempts).toBe(1);
  });

  it('rescues a too-soft stroke by changing only unlocked strength', () => {
    const source = request({ speed: 0.1 }, { ...allLocks, speed: false });
    const original = structuredClone(source);
    const result = fitLabShot(source);
    expectPlayable(source, result);
    expect(result.changed).toEqual(['speed']);
    expect(result.settings.speed).toBeGreaterThan(0.1);
    expect(source).toEqual(original);
  });

  it('preserves every combination of numeric locks while fitting another value', () => {
    const keys = ['speed', 'topSpin', 'sideSpin'] as const;
    for (let mask = 0; mask < 8; mask++) {
      const locks: LabShotLocks = { ballId: true, pocketId: true };
      keys.forEach((key, index) => { locks[key] = Boolean(mask & (1 << index)); });
      const source = request({ aimOffset: 8 }, locks);
      const result = fitLabShot(source);
      expectPlayable(source, result);
      expect(result.changed).toContain('aimOffset');
    }
    // Include locked aim with each spin combination, forcing strength to adapt.
    for (let mask = 0; mask < 4; mask++) {
      const source = request({ speed: 0.1 }, { ballId: true, pocketId: true, aimOffset: true,
        topSpin: Boolean(mask & 1), sideSpin: Boolean(mask & 2) });
      expectPlayable(source, fitLabShot(source));
    }
    // The four remaining combinations also lock aim and strength: a working
    // stroke should remain exact instead of manufacturing unnecessary changes.
    for (let mask = 0; mask < 4; mask++) {
      const source = request({}, { ballId: true, pocketId: true, aimOffset: true, speed: true,
        topSpin: Boolean(mask & 1), sideSpin: Boolean(mask & 2) });
      const result = fitLabShot(source);
      expectPlayable(source, result);
      expect(result.changed).toEqual([]);
    }
  });

  it('keeps strong draw and side spin while adapting strength and aim', () => {
    const source = request({ speed: 0.1, topSpin: -1.5, sideSpin: 60 }, { ballId: true, pocketId: true, topSpin: true, sideSpin: true });
    expectPlayable(source, fitLabShot(source));
  });

  it('fits a cut requiring fine aim compensation with strength and spins fixed', () => {
    const source = request({ speed: 1.6, topSpin: 0, sideSpin: 70 }, { ...allLocks, aimOffset: false });
    source.scenario.balls[0].position = { x: 1, y: 0.95 };
    const original = simulateShot(source.scenario, createLabShot(source.scenario, source.variant.settings, 'before', 'Before'), { record: false });
    expect(original.pocketEvents?.some(event => event.ballId === 1 && event.pocketId === 1)).toBe(false);
    const result = fitLabShot(source);
    expectPlayable(source, result);
    expect(result.changed).toEqual(['aimOffset']);
    expect(Math.abs(result.settings.aimOffset)).toBeLessThan(2);
  });

  it('reports failed locked strokes exactly without claiming exhaustive impossibility', () => {
    const source = request({ speed: 0.1 }, allLocks);
    const result = fitLabShot(source);
    expect(result).toMatchObject({ status: 'not-found', settings: source.variant.settings, changed: [], attempts: 1 });
    expect(result.message).toMatch(/No playable shot found/);
  });

  it('leaves the layout and settings untouched when a blocked route has no found solution', () => {
    const source = request({ aimOffset: 180, speed: 0.1 }, { ...allLocks, speed: false });
    source.scenario.balls.push({ id: 2, position: { x: 1.27, y: 0.65 } });
    const original = structuredClone(source);
    const result = fitLabShot(source);
    expect(result.status).toBe('not-found');
    expect(result.settings).toEqual(original.variant.settings);
    expect(result.changed).toEqual([]);
    expect(result.attempts).toBeLessThanOrEqual(MAX_LAB_AUTO_ATTEMPTS);
    expect(source).toEqual(original);
  });

  it('can change an unlocked ball nomination when another ball blocks the selected route', () => {
    const source = request({}, { topSpin: true, sideSpin: true });
    source.scenario.balls.push({ id: 2, position: { x: 1.27, y: 0.65 } });
    source.scenario.balls.push({ id: 3, position: { x: 0.5, y: 0.35 } });
    const result = fitLabShot(source);
    expectPlayable(source, result);
    expect(result.settings.ballId).not.toBe(1);
    expect(result.changed).toContain('ballId');
  });

  it('can change an unlocked pocket nomination and is deterministic', () => {
    const source = request({ pocketId: 4 }, { ...allLocks, pocketId: false });
    const result = fitLabShot(source);
    expectPlayable(source, result);
    expect(result.settings.pocketId).not.toBe(4);
    expect(result.changed).toEqual(['pocketId']);
    expect(fitLabShot(source)).toEqual(result);
  });

  it('rejects invalid locked controls but repairs invalid unlocked preferences', () => {
    for (const [key, value] of Object.entries({ ballId: 8, pocketId: 9, speed: Number.NaN, topSpin: 3, sideSpin: Number.NaN, aimOffset: 181 })) {
      expect(() => fitLabShot(request({ [key]: value }, { [key]: true }))).toThrow();
    }
    const source = request({ ballId: 8, pocketId: 9, speed: Number.NaN, topSpin: 3, sideSpin: Number.NaN, aimOffset: 181 });
    const result = fitLabShot(source);
    expectPlayable(source, result);
    expect(result.settings).toEqual(DEFAULT_LAB_SHOT_SETTINGS);
  });

  it('caps a deep failed search and returns the unchanged original settings', () => {
    const source = request({ aimOffset: 180, speed: 0.1 }, { ballId: true, pocketId: true, aimOffset: true });
    const original = structuredClone(source);
    const result = fitLabShot(source);
    expect(result).toMatchObject({ status: 'not-found', settings: original.variant.settings, changed: [], attempts: MAX_LAB_AUTO_ATTEMPTS });
    expect(source).toEqual(original);
  });
});
