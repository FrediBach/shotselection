import { expect, it } from 'vitest';
import { compareHouseCue } from './house-cue';
import { analyzeShot } from './analysis';
import { simulateShot } from './physics';
import { cueStroke } from './table-conditions';
import { prepareRound } from './preparation';
import { generateScenario } from './scenarios';
import { distance } from './math';

it.each([0, 1, 5, 8, 95 * 919])('isolates reduced spin delivery with the house cue, seed %i', seed => {
  const source = generateScenario(95, seed), saved = structuredClone(source), prepared = prepareRound(source, { regenerate: false });
  let zero = 0, sensitive = 0;
  for (const ball of prepared.balls) for (const option of ball.options) {
    const analysis = analyzeShot(source, option.plan, 8), before = structuredClone(analysis), plan = structuredClone(option.plan);
    const data = compareHouseCue(source, option.plan, analysis.nominal)!;
    expect(data).not.toBeNull();
    expect(data.variants[0].simulation).toBe(analysis.nominal);
    const restored = { ...source, conditions: { ...source.conditions!, cue: { ...source.conditions!.cue!, spin: 1 } } };
    expect(data.variants[1].scenario).toEqual(restored);
    expect(data.variants[1].simulation).toEqual(simulateShot(restored, option.plan));
    expect(data.delivered).toEqual(cueStroke(option.plan, source.conditions));
    expect(data.delivered.topSpin).toBe(option.plan.topSpin * .68);
    expect(data.delivered.sideSpin).toBe(option.plan.sideSpin * .68);
    expect(data.restored.topSpin).toBe(option.plan.topSpin);
    expect(data.restored.speed).toBe(data.delivered.speed);
    expect(data.restored.angle).toBe(data.delivered.angle);
    expect(data.delivered.speed).toBeCloseTo(option.plan.speed * .82, 12);
    expect(data.finishShift).toBe(distance(analysis.nominal.cueEnd, data.variants[1].simulation.cueEnd));
    if (option.plan.topSpin === 0 && option.plan.sideSpin === 0) {
      zero++; expect(data.finishShift).toBe(0); expect(data.variants[1].simulation).toEqual(analysis.nominal);
    }
    if (Math.abs(option.plan.topSpin) >= .6 && data.finishShift > .05) sensitive++;
    expect(option.plan).toEqual(plan); expect(analysis).toEqual(before);
    expect(analyzeShot({ ...source, curriculum: undefined }, option.plan, 8)).toEqual(analysis);
    expect(compareHouseCue({ ...source, conditions: undefined }, option.plan, analysis.nominal)).toBeNull();
    expect(compareHouseCue(restored, option.plan, analysis.nominal)).toBeNull();
  }
  expect(zero).toBeGreaterThan(0); expect(sensitive).toBeGreaterThan(0);
  expect(source).toEqual(saved);
}, 30000);
