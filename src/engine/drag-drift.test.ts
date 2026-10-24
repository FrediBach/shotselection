import { expect, it } from 'vitest';
import { compareDragDrift } from './drag-drift';
import { analyzeShot } from './analysis';
import { simulateShot } from './physics';
import { evaluateShotObjective } from './objectives';
import { prepareRound } from './preparation';
import { generateScenario } from './scenarios';
import { distance } from './math';

it.each([0, 1, 5, 8, 98 * 919])('shows the coupled pace tradeoff under matched fault conditions, seed %i', seed => {
  const source = generateScenario(98, seed), saved = structuredClone(source), prepared = prepareRound(source, { regenerate: false });
  let tradeoffs = 0;
  for (const ball of prepared.balls) for (const option of ball.options) {
    const analysis = analyzeShot(source, option.plan, 8), before = structuredClone(analysis);
    const data = compareDragDrift(source, option.plan, analysis.nominal)!;
    expect(data).toHaveLength(3); expect(data[1].variants[0].simulation).toBe(analysis.nominal);
    for (const [i, pace] of data.entries()) {
      expect(pace.plan).toEqual({ ...option.plan, speed: option.plan.speed * [.9, 1, 1.25][i] });
      expect(pace.plan.speed).toBeLessThan(4);
      expect(pace.variants[0].scenario).toBe(source);
      expect(pace.variants[1].scenario).toEqual({ ...source, conditions: { ...source.conditions!, nap: undefined } });
      expect(pace.variants[2].scenario).toEqual({ ...source, conditions: { ...source.conditions!, cloth: 1 } });
      for (const v of pace.variants) {
        expect(v.simulation).toEqual(simulateShot(v.scenario, pace.plan));
        expect(v.outcome).toEqual(evaluateShotObjective(v.scenario, pace.plan, v.simulation));
      }
    }
    const slow = data[0].variants[0].outcome, fast = data[2].variants[0].outcome;
    if (!slow.legalPot && fast.legalPot && fast.error > slow.error) tradeoffs++;
    expect(distance(data[1].variants[0].simulation.cueEnd, data[1].variants[1].simulation.cueEnd)).toBeGreaterThan(.001);
    expect(distance(data[1].variants[0].simulation.cueEnd, data[1].variants[2].simulation.cueEnd)).toBeGreaterThan(.001);
    expect(analyzeShot({ ...source, curriculum: undefined }, option.plan, 8)).toEqual(analysis);
    expect(compareDragDrift({ ...source, conditions: undefined }, option.plan, analysis.nominal)).toBeNull();
    expect(analysis).toEqual(before);
  }
  expect(tradeoffs).toBeGreaterThan(0); expect(source).toEqual(saved);
}, 30000);
