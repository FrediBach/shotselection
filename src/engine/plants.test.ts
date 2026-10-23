import { describe, expect, it } from 'vitest';
import { analyzeShot } from './analysis';
import { TABLE } from './constants';
import { distance } from './math';
import { evaluateShotObjective } from './objectives';
import { simulateShot } from './physics';
import { plantRoutesFor } from './plant-routes';
import { MIN_FINISH_SEPARATION, prepareRound } from './preparation';
import type { Scenario, ShotPlan } from './types';

const aligned: Scenario = {
  level: 61, seed: 71431, title: 'Read the pair', description: '',
  plant: { ballId: 1, targetBallId: 2, pocketId: 1 },
  balls: [
    { id: 0, position: { x: 1.05, y: 0.95 } },
    { id: 1, position: { x: 1.27, y: 0.4 } },
    { id: 2, position: { x: 1.27, y: 0.3 } },
    { id: 3, position: { x: 2.1, y: 0.4 } },
  ],
};

describe('plant decisions', () => {
  it('offers the plant and a proven free-ball triple while reserving the target ball', () => {
    const prepared = prepareRound(aligned);
    expect(prepared.scenario).toEqual(aligned);
    expect(prepared.balls.map(ball => ball.ballId)).toEqual([1, 3]);
    for (const group of prepared.balls) {
      expect(group.options).toHaveLength(3);
      for (const option of group.options) {
        const result = simulateShot(aligned, option.plan);
        expect(result.firstContact).toBe(group.ballId);
        expect(result.potted).toContain(option.plan.potBallId ?? group.ballId);
        expect(result.scratch).toBe(false);
        expect(result.stopped).toBe(true);
        expect(result.cueEnd).toEqual(option.plan.target);
        expect(evaluateShotObjective(aligned, option.plan, result).success).toBe(true);
        for (const other of group.options) {
          if (other.id === option.id) continue;
          expect(distance(option.plan.target, other.plan.target)).toBeGreaterThanOrEqual(MIN_FINISH_SEPARATION);
          expect(Math.abs(option.plan.speed - other.plan.speed)).toBeGreaterThanOrEqual(0.12);
          expect(Math.abs(option.plan.topSpin - other.plan.topSpin)).toBeGreaterThanOrEqual(0.35);
        }
      }
    }
    expect(prepareRound(aligned)).toEqual(prepared);
  });

  it('keeps a misaligned plant selectable without inventing pots or cue endpoints', () => {
    const misaligned = { ...aligned, balls: aligned.balls.map(ball => ball.id === 1
      ? { ...ball, position: { x: 1.295, y: 0.4 } } : ball) };
    const prepared = prepareRound(misaligned);
    expect(prepared.scenario).toEqual(misaligned);
    expect(prepared.balls.map(ball => ball.ballId)).toEqual([1, 3]);
    const plant = prepared.balls[0];
    for (const option of plant.options) {
      const result = simulateShot(misaligned, option.plan);
      expect(result.firstContact).toBe(1);
      expect(result.potted).not.toContain(2);
      expect(result.scratch).toBe(false);
      expect(result.stopped).toBe(true);
      expect(result.cueEnd).toEqual(option.plan.target);
      expect(result.cueEnd.x).toBeGreaterThanOrEqual(TABLE.ballRadius);
      expect(result.cueEnd.x).toBeLessThanOrEqual(TABLE.length - TABLE.ballRadius);
      expect(result.cueEnd.y).toBeGreaterThanOrEqual(TABLE.ballRadius);
      expect(result.cueEnd.y).toBeLessThanOrEqual(TABLE.width - TABLE.ballRadius);
      expect(evaluateShotObjective(misaligned, option.plan, result).legalPot).toBe(false);
    }
    expect(plant.options[0].plan.angle).toBe(plantRoutesFor(misaligned, 1)[0].angle);
    expect(plant.options[0].plan.angle).not.toBe(plantRoutesFor(aligned, 1)[0].angle);
  });

  it('scores and traces the second ball, still requiring first contact with the first ball', () => {
    const plan = prepareRound(aligned).balls[0].options[0].plan;
    const analysis = analyzeShot(aligned, plan, 16);
    expect(plan.potBallId).toBe(2);
    expect(analysis.nominal.objectPath[0]).toEqual(aligned.balls[2].position);
    expect(analysis.nominal.objectPath.at(-1)).toEqual(analysis.nominal.finalBalls.find(ball => ball.id === 2)!.position);
    expect(analysis.nominal.potted).not.toContain(1);
    expect(analysis.potRate).toBeGreaterThan(0);
    expect(analysis.successRate).toBeGreaterThan(0);
    expect(analysis.sampleObjectPaths.filter(trial => trial.outcome === 'pot')).toHaveLength(analysis.potRate * 16);
    for (const trial of analysis.sampleObjectPaths) expect(trial.path[0]).toEqual(aligned.balls[2].position);
    const wrongFirst: ShotPlan = { ...plan, ballId: 2 };
    const invalid = analyzeShot(aligned, wrongFirst, 8);
    expect(invalid.potRate).toBe(0);
    expect(invalid.successRate).toBe(0);
    expect(invalid.sampleObjectPaths.some(trial => trial.outcome === 'foul')).toBe(true);
    expect(evaluateShotObjective(aligned, plan, { ...analysis.nominal, potted: [1] }).legalPot).toBe(false);
    expect(evaluateShotObjective(aligned, { ...plan, potBallId: 1 }, { ...analysis.nominal, potted: [1] }).legalPot).toBe(false);
  });

  it('rejects incomplete or conflicting decisions instead of reducing them to a single choice', () => {
    expect(() => prepareRound({ ...aligned, plant: { ...aligned.plant!, targetBallId: 1 } })).toThrow(/two distinct object balls/);
    expect(() => prepareRound({ ...aligned, plant: { ...aligned.plant!, pocketId: 9 } })).toThrow(/a pocket/);
    expect(() => prepareRound({ ...aligned, balls: aligned.balls.filter(ball => ball.id !== 3) })).toThrow(/free ball/);
    expect(() => prepareRound({ ...aligned, bank: { ballId: 1, minCushions: 1 } })).toThrow(/bank or position/);
    const noCueRoute = { ...aligned, balls: aligned.balls.map(ball => ball.id === 0
      ? { ...ball, position: { x: 1.27, y: 0.1 } } : ball) };
    expect(() => prepareRound(noCueRoute)).toThrow(/this lesson and its objective/);
  });
});
