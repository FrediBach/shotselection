import { expect, it } from 'vitest';
import { compareCloth } from './cloth-comparison';
import { analyzeShot } from './analysis';
import { simulateShot } from './physics';
import { prepareRound } from './preparation';
import { generateScenario } from './scenarios';
import { distance } from './math';
import { evaluateShotObjective } from './objectives';

it.each([0, 1, 5, 8, 91 * 919])('compares identical launches with only cloth drag changed, seed %i', seed => {
  const source = generateScenario(91, seed), saved = structuredClone(source);
  const prepared = prepareRound(source, { regenerate: false });
  expect(prepared.scenario).toEqual(source);
  expect(prepared.balls.length).toBeGreaterThanOrEqual(2);
  const shifts: number[] = [];
  for (const ball of prepared.balls) for (const option of ball.options) {
    const planBefore = structuredClone(option.plan);
    const analysis = analyzeShot(source, option.plan, 8), before = structuredClone(analysis);
    const data = compareCloth(source, option.plan, analysis.nominal)!;
    expect(data).not.toBeNull();
    expect(data.variants[0].simulation).toBe(analysis.nominal);
    expect(data.variants[0].scenario).toBe(source);
    const normal = { ...source, conditions: { ...source.conditions!, cloth: 1 } };
    expect(data.variants[1].scenario).toEqual(normal);
    expect(data.variants[1].simulation).toEqual(simulateShot(normal, option.plan));
    expect(data.variants[1].simulation).toEqual(simulateShot({ ...source, conditions: undefined }, option.plan));
    for (const variant of data.variants) expect(variant.outcome).toEqual(evaluateShotObjective(variant.scenario, option.plan, variant.simulation));
    expect(data.finishShift).toBe(distance(analysis.nominal.cueEnd, data.variants[1].simulation.cueEnd));
    shifts.push(data.finishShift);
    expect(analysis).toEqual(before); expect(option.plan).toEqual(planBefore);
    expect(analyzeShot({ ...source, curriculum: undefined }, option.plan, 8)).toEqual(analysis);
    expect(compareCloth({ ...source, conditions: undefined }, option.plan, analysis.nominal)).toBeNull();
    expect(compareCloth(normal, option.plan, analysis.nominal)).toBeNull();
  }
  expect(shifts.filter(shift => shift > .05).length).toBeGreaterThanOrEqual(2);
  expect(source).toEqual(saved);
}, 30000);
