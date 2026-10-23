import { describe, expect, it } from 'vitest';
import { analyzeRound, analyzeShot } from './analysis';
import { TABLE } from './constants';
import { distance } from './math';
import { simulateShot } from './physics';
import { MIN_FINISH_SEPARATION, prepareRound } from './preparation';
import { generateScenario } from './scenarios';
import type { PreparedRound, Scenario } from './types';

function verifyPrepared(prepared: PreparedRound) {
  expect(prepared.balls.length).toBeGreaterThan(0);
  const ids = new Set<string>();
  for (const ball of prepared.balls) {
    expect(ball.options).toHaveLength(3);
    expect(ball.options.map(option => option.label)).toEqual(['A', 'B', 'C']);
    for (const option of ball.options) {
      expect(ids.has(option.id)).toBe(false);
      ids.add(option.id);
      expect(option.plan.id).toBe(option.id);
      expect(option.plan.ballId).toBe(ball.ballId);
      const nominal = simulateShot(prepared.scenario, option.plan);
      expect(nominal.firstContact).toBe(ball.ballId);
      expect(nominal.potted).toContain(ball.ballId);
      expect(nominal.scratch).toBe(false);
      expect(nominal.stopped).toBe(true);
      expect(distance(nominal.cueEnd, option.plan.target)).toBeLessThan(1e-9);
      expect(option.plan.target.x).toBeGreaterThanOrEqual(TABLE.ballRadius);
      expect(option.plan.target.x).toBeLessThanOrEqual(TABLE.length - TABLE.ballRadius);
      expect(option.plan.target.y).toBeGreaterThanOrEqual(TABLE.ballRadius);
      expect(option.plan.target.y).toBeLessThanOrEqual(TABLE.width - TABLE.ballRadius);
      for (const other of ball.options) {
        if (other.id === option.id) continue;
        expect(distance(option.plan.target, other.plan.target)).toBeGreaterThanOrEqual(MIN_FINISH_SEPARATION);
        expect(Math.abs(option.plan.speed - other.plan.speed)).toBeGreaterThanOrEqual(0.12);
        expect(Math.abs(option.plan.topSpin - other.plan.topSpin)).toBeGreaterThanOrEqual(0.35);
      }
    }
  }
}

describe('three feasible fixed finishes', () => {
  it.each([71431, 71431 + 919])('keeps the introductory pot playable for seed %s', seed => {
    // App advances the stored seed by level * 919 before preparing the layout.
    const scenario = generateScenario(1, seed);
    const prepared = prepareRound(scenario);
    expect(prepared.scenario).toEqual(scenario);
    expect(prepared.balls.map(ball => ball.ballId)).toEqual([1]);
    verifyPrepared(prepared);
  });

  it.each([[1, 72350], [10, 118], [20, 9921], [30, 78220], [40, 123], [50, 273], [60, 912]])('offers stopped legal distinct finishes at level %s, seed %s', (level, seed) => {
    verifyPrepared(prepareRound(generateScenario(level, seed)));
  }, 30000);

  it('prepares the same plans for the same layout without ranking the labels', () => {
    const scenario = generateScenario(1, 72350);
    const first = prepareRound(scenario);
    expect(prepareRound(scenario)).toEqual(first);
    for (const ball of first.balls) expect(ball.options.map(option => option.plan.speed)).toEqual(ball.options.map(option => option.plan.speed).sort((a, b) => a - b));
  });

  it('produces different ensembles for the three exact stroke settings', () => {
    const prepared = prepareRound(generateScenario(1, 72350));
    const analyses = prepared.balls[0].options.map(option => analyzeShot(prepared.scenario, option.plan, 8));
    expect(analyses[0].sampleEnds).not.toEqual(analyses[1].sampleEnds);
    expect(analyses[0].sampleEnds).not.toEqual(analyses[2].sampleEnds);
    expect(analyses[1].sampleEnds).not.toEqual(analyses[2].sampleEnds);
    for (let i = 0; i < analyses.length; i++) expect(analyses[i].plan).toEqual(prepared.balls[0].options[i].plan);
  });

  it('does not call a time-truncated moving cue ball a feasible resting finish', () => {
    const prepared = prepareRound(generateScenario(1));
    const result = simulateShot(prepared.scenario, prepared.balls[0].options[0].plan, { maxTime: 0.1 });
    expect(result.stopped).toBe(false);
  });

  it('rejects stale, mismatched and nonexistent options before simulation', () => {
    const prepared = prepareRound(generateScenario(1, 72350));
    const stale = prepareRound(generateScenario(1, 72351)).balls[0].options[0];
    const current = prepared.balls[0].options[0];
    expect(() => analyzeRound(prepared, { ballId: stale.plan.ballId, optionId: stale.id })).toThrow(/not available/);
    expect(() => analyzeRound(prepared, { ballId: current.plan.ballId + 100, optionId: current.id })).toThrow(/not available/);
    expect(() => analyzeRound(prepared, { ballId: current.plan.ballId, optionId: 'invented' })).toThrow(/not available/);
  });

  it('disables a completely screened object ball instead of inventing finishes', () => {
    const scenario: Scenario = { level: 4, seed: 7, title: 'Screened ball', description: 'Test', balls: [
      { id: 0, position: { x: 0.73, y: 0.83 } },
      { id: 1, position: { x: 2.15, y: 0.94 } },
      { id: 2, position: { x: 1.16, y: 0.33 } },
      ...Array.from({ length: 6 }, (_, index) => ({ id: index + 3, position: { x: 2.15 + Math.cos(index * Math.PI / 3) * 0.07, y: 0.94 + Math.sin(index * Math.PI / 3) * 0.07 } })),
    ] };
    const prepared = prepareRound(scenario);
    expect(prepared.scenario).toEqual(scenario);
    expect(prepared.balls.some(ball => ball.ballId === 1)).toBe(false);
    verifyPrepared(prepared);
  });

  it('deterministically regenerates an unplayable layout and verifies its options', () => {
    const scenario = { ...generateScenario(6, 55), balls: [{ id: 0, position: { x: 1, y: 0.6 } }] };
    const prepared = prepareRound(scenario);
    expect(prepared.scenario.seed).not.toBe(scenario.seed);
    expect(prepared.scenario.level).toBe(scenario.level);
    expect(prepareRound(scenario)).toEqual(prepared);
    verifyPrepared(prepared);
  }, 30000);
});
