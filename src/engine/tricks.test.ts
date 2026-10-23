import { describe, expect, it } from 'vitest';
import { analyzeShot } from './analysis';
import { TABLE } from './constants';
import { distance } from './math';
import { evaluateShotObjective } from './objectives';
import { simulateShot } from './physics';
import { MIN_FINISH_SEPARATION, prepareRound } from './preparation';
import { generateScenario } from './scenarios';
import { POCKET_GEOMETRY } from './table-geometry';
import type { Scenario } from './types';

function orientations(level: number): Scenario[] {
  const scenarios = new Map<string, Scenario>();
  for (let seed = 1; seed <= 100 && scenarios.size < 4; seed++) {
    const scenario = generateScenario(level, seed);
    scenarios.set(JSON.stringify(scenario.balls.map(ball => ball.position)), scenario);
  }
  return [...scenarios.values()];
}

describe('trick-shot curriculum', () => {
  it.each(Array.from({ length: 10 }, (_, index) => index + 81))('proves the full level %i trick in every table reflection', level => {
    const variants = orientations(level);
    expect(variants).toHaveLength(4);
    for (const scenario of variants) {
      const prepared = prepareRound(scenario, { regenerate: false });
      expect(prepared.scenario).toEqual(scenario);
      expect(prepared.balls.map(ball => ball.ballId)).toEqual([scenario.trick!.ballId]);
      const options = prepared.balls[0].options;
      expect(options).toHaveLength(3);
      for (const option of options) {
        const simulation = simulateShot(scenario, option.plan, { record: false });
        expect(evaluateShotObjective(scenario, option.plan, simulation).success, `${level} / seed ${scenario.seed} / ${option.label}`).toBe(true);
        expect(simulation.stopped).toBe(true);
        expect(simulation.scratch).toBe(false);
        expect(simulation.firstContact).toBe(scenario.trick!.ballId);
        expect(simulation.cueEnd).toEqual(option.plan.target);
        expect(simulation.potted).toEqual(expect.arrayContaining(scenario.trick!.requiredPots));
        const pocket = POCKET_GEOMETRY[scenario.trick!.pocketId];
        const targetBall = simulation.finalBalls.find(ball => ball.id === scenario.trick!.potBallId)!;
        expect(distance(targetBall.position, pocket.center)).toBeLessThan(pocket.radius);
        for (const other of options) if (other.id !== option.id) {
          expect(distance(option.plan.target, other.plan.target)).toBeGreaterThanOrEqual(MIN_FINISH_SEPARATION);
          expect(Math.abs(option.plan.speed - other.plan.speed)).toBeGreaterThanOrEqual(0.12);
          expect(Math.abs(option.plan.topSpin - other.plan.topSpin)).toBeGreaterThanOrEqual(0.35);
        }
      }
      const rates = options.map(option => analyzeShot(scenario, option.plan, 16).successRate);
      expect(Math.max(...rates), `${level} / seed ${scenario.seed} ensemble`).toBeGreaterThan(0);
    }
  }, 60000);

  it('requires every pot, the ordered collision sequence and the designated physical pocket', () => {
    const prepared = prepareRound(generateScenario(85));
    const scenario = prepared.scenario;
    const plan = prepared.balls[0].options[0].plan;
    const simulation = simulateShot(scenario, plan, { record: false });
    expect(evaluateShotObjective(scenario, plan, simulation).legalPot).toBe(true);
    expect(evaluateShotObjective(scenario, plan, { ...simulation, potted: [2] }).legalPot).toBe(false);
    expect(evaluateShotObjective(scenario, plan, { ...simulation, ballContacts: [[0, 1], [1, 2]] }).legalPot).toBe(false);
    expect(evaluateShotObjective(scenario, plan, { ...simulation, ballContacts: [[0, 1], [0, 1], [1, 2]] }).legalPot).toBe(false);
    expect(evaluateShotObjective(scenario, plan, { ...simulation, firstContact: 2 }).legalPot).toBe(false);
    const wrongPocket = simulation.finalBalls.map(ball => ball.id === 2
      ? { ...ball, position: POCKET_GEOMETRY[(scenario.trick!.pocketId + 1) % 6].center } : ball);
    expect(evaluateShotObjective(scenario, plan, { ...simulation, finalBalls: wrongPocket }).legalPot).toBe(false);
    const analysis = analyzeShot(scenario, plan, 16);
    expect(analysis.potRate).toBe(analysis.sampleBallEnds.filter(balls => [1, 2].every(id => balls.some(ball => ball.id === id && ball.pocketed))).length / 16);
  });

  it('requires object-ball cushions for a bank and cue-ball cushions for a kick', () => {
    for (const level of [87, 89]) {
      const prepared = prepareRound(generateScenario(level));
      const plan = prepared.balls[0].options[0].plan;
      const simulation = simulateShot(prepared.scenario, plan, { record: false });
      expect(evaluateShotObjective(prepared.scenario, plan, simulation).legalPot).toBe(true);
      const incomplete = level === 87 ? { ...simulation, objectCushions: 0, cueBanksBeforeContact: 2 }
        : { ...simulation, cueBanksBeforeContact: 1, objectCushions: 2 };
      expect(evaluateShotObjective(prepared.scenario, plan, incomplete).legalPot).toBe(false);
    }
  });

  it('reflects the authored aim and pocket and offers physically effective English in the finale', () => {
    const variants = orientations(90);
    const base = variants[0];
    for (const scenario of variants) {
      const xReflected = scenario.balls[0].position.x !== base.balls[0].position.x;
      const yReflected = scenario.balls[0].position.y !== base.balls[0].position.y;
      expect(scenario.trick!.aim.x).toBeCloseTo(xReflected ? TABLE.length - base.trick!.aim.x : base.trick!.aim.x, 12);
      expect(scenario.trick!.aim.y).toBeCloseTo(yReflected ? TABLE.width - base.trick!.aim.y : base.trick!.aim.y, 12);
    }
    const prepared = prepareRound(generateScenario(90));
    const options = prepared.balls[0].options;
    expect(options.filter(option => option.plan.sideSpin !== 0)).toHaveLength(1);
    const plan = options.find(option => option.plan.sideSpin !== 0)!.plan;
    const withEnglish = simulateShot(prepared.scenario, plan, { record: false });
    const withoutEnglish = simulateShot(prepared.scenario, { ...plan, sideSpin: 0 }, { record: false });
    expect(distance(withEnglish.cueEnd, withoutEnglish.cueEnd)).toBeGreaterThan(0.001);
  });

  it('rejects incomplete trick contracts instead of silently offering ordinary pots', () => {
    const scenario = generateScenario(81);
    expect(() => prepareRound({ ...scenario, trick: { ...scenario.trick!, requiredPots: [] } })).toThrow(/trick shot needs/);
    expect(() => prepareRound({ ...scenario, trick: { ...scenario.trick!, requiredContacts: [[1, 99]] } })).toThrow(/trick shot needs/);
    expect(() => prepareRound({ ...scenario, trick: { ...scenario.trick!, aim: { x: NaN, y: 0 } } })).toThrow(/trick shot needs/);
    expect(() => prepareRound({ ...scenario, trick: { ...scenario.trick!, minObjectCushions: -1 } })).toThrow(/trick shot needs/);
    const blocked = { ...scenario, balls: scenario.balls.map(ball => ball.id === 0 ? { ...ball, position: { x: 0.2, y: 0.2 } } : ball) };
    expect(() => prepareRound(blocked, { regenerate: false })).toThrow(/No feasible/);
  });
});
