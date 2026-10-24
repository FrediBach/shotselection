import { expect, it } from 'vitest';
import { compareSlickPatch } from './slick-patch';
import { clipPatchPath } from './patch-route';
import { analyzeShot } from './analysis';
import { simulateShot } from './physics';
import { clothFrictionAt } from './table-conditions';
import { prepareRound } from './preparation';
import { generateScenario } from './scenarios';
import { distance } from './math';

it.each([0, 1, 5, 8, 97 * 919])('isolates the slick patch while retaining the sticky repair, seed %i', seed => {
  const source = generateScenario(97, seed), saved = structuredClone(source), prepared = prepareRound(source, { regenerate: false });
  let changed = 0, crossed = 0, clear = 0;
  for (const ball of prepared.balls) for (const option of ball.options) {
    const analysis = analyzeShot(source, option.plan, 8), before = structuredClone(analysis);
    const data = compareSlickPatch(source, option.plan, analysis.nominal)!;
    expect(data).not.toBeNull();
    const [actual, ordinary] = data.variants;
    expect(actual.simulation).toBe(analysis.nominal);
    const expected = { ...source, conditions: { ...source.conditions!, patches: source.conditions!.patches!.map(p => p.id === data.slick.id ? { ...p, friction: 1 } : p) } };
    expect(ordinary.scenario).toEqual(expected); expect(ordinary.simulation).toEqual(simulateShot(expected, option.plan));
    expect(clothFrictionAt(data.slick.center, source.conditions)).toBe(.6);
    expect(clothFrictionAt(data.slick.center, ordinary.scenario.conditions)).toBe(1);
    const sticky = source.conditions!.patches!.find(p => p.friction > 1)!;
    expect(clothFrictionAt(sticky.center, source.conditions)).toBe(2.4);
    expect(clothFrictionAt(sticky.center, ordinary.scenario.conditions)).toBe(2.4);
    for (const variant of data.variants) for (const route of variant.routes) for (const crossing of route.crossings) {
      expect(crossing.segments).toEqual(clipPatchPath(route.path, crossing.patch.center, crossing.patch.radius));
      expect(crossing.length).toBe(crossing.segments.reduce((sum, [a, b]) => sum + distance(a, b), 0));
      for (const [a, b] of crossing.segments) {
        expect(distance(a, crossing.patch.center)).toBeLessThanOrEqual(crossing.patch.radius + 1e-9);
        expect(distance(b, crossing.patch.center)).toBeLessThanOrEqual(crossing.patch.radius + 1e-9);
      }
      if (crossing.patch.id === data.slick.id) { if (crossing.length > 0) crossed++; else clear++; }
    }
    expect(data.finishShift).toBe(distance(actual.simulation.cueEnd, ordinary.simulation.cueEnd));
    if (data.finishShift > .01) changed++;
    expect(analyzeShot({ ...source, curriculum: undefined }, option.plan, 8)).toEqual(analysis);
    expect(compareSlickPatch({ ...source, conditions: undefined }, option.plan, analysis.nominal)).toBeNull();
    expect(compareSlickPatch(ordinary.scenario, option.plan, analysis.nominal)).toBeNull();
    expect(analysis).toEqual(before);
  }
  expect(changed).toBeGreaterThan(0); expect(crossed).toBeGreaterThan(0); expect(clear).toBeGreaterThan(0);
  expect(source).toEqual(saved);
}, 30000);
