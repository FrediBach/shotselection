import { describe, expect, it } from 'vitest';
import { analyzeRound, analyzeShot, pointsFor } from './analysis';
import { TABLE, positionToleranceForLevel } from './constants';
import { distance } from './math';
import { simulateShot } from './physics';
import { generateScenario, TOTAL_LEVELS } from './scenarios';
import { prepareRound } from './preparation';
import type { Scenario, ShotPlan } from './types';

const straight: Scenario = {
  level: 1, seed: 42, title: 'Straight pot', description: 'Test fixture',
  balls: [{ id: 0, position: { x: 1.27, y: 0.85 } }, { id: 1, position: { x: 1.27, y: 0.3 } }],
};
const plan: ShotPlan = {
  id: 'straight', ballId: 1, pocketId: 1, target: { x: 1.27, y: 0.38 },
  angle: -Math.PI / 2, speed: 1.35, topSpin: 0, sideSpin: 0, label: 'Straight pot',
};

describe('physical simulation', () => {
  it('uses regulation dimensions and a reproducible, non-overlapping layout', () => {
    expect(TABLE.length).toBe(2.54);
    expect(TABLE.width).toBe(1.27);
    expect(TABLE.ballDiameter).toBe(0.05715);
    expect(generateScenario(4, 101)).toEqual(generateScenario(4, 101));
    for (let level = 1; level <= TOTAL_LEVELS; level++) {
      const scenario = generateScenario(level);
      for (const ball of scenario.balls) {
        expect(ball.position.x).toBeGreaterThan(TABLE.ballRadius);
        expect(ball.position.x).toBeLessThan(TABLE.length - TABLE.ballRadius);
        for (const other of scenario.balls) if (ball.id !== other.id) expect(distance(ball.position, other.position)).toBeGreaterThan(TABLE.ballDiameter);
      }
    }
  });

  it('transfers momentum on first contact and pots a straight object ball', () => {
    const result = simulateShot(straight, plan);
    expect(result.firstContact).toBe(1);
    expect(result.potted).toContain(1);
    expect(result.duration).toBeGreaterThan(0.4);
    expect(result.frames[0].balls[1].position.y).toBe(0.3);
    expect(result.objectPath.at(-1)!.y).toBeLessThan(0.04);
  });

  it('detects a cue-ball scratch through an actual pocket opening', () => {
    const scenario = { ...straight, balls: [{ id: 0, position: { x: 1.27, y: 0.2 } }] };
    const result = simulateShot(scenario, { ...plan, topSpin: 1 });
    expect(result.scratch).toBe(true);
    expect(result.potted).toContain(0);
  });

  it('reflects off a cushion instead of treating the whole boundary as pockets', () => {
    const scenario = { ...straight, balls: [{ id: 0, position: { x: 0.5, y: 0.12 } }] };
    const result = simulateShot(scenario, { ...plan, speed: 0.5, topSpin: 1 });
    expect(result.scratch).toBe(false);
    expect(result.cueEnd.y).toBeGreaterThan(0.12);
    expect(result.cuePath.every(point => point.y >= TABLE.ballRadius - 0.001)).toBe(true);
  });

  it('matches the rolling-friction stopping distance without a collision', () => {
    const scenario = { ...straight, balls: [{ id: 0, position: { x: 0.5, y: 0.6 } }] };
    const speed = 0.3;
    const result = simulateShot(scenario, { ...plan, angle: 0, speed, topSpin: 1 });
    const expected = speed * speed / (2 * TABLE.rollingFriction * 9.80665);
    expect(result.cueEnd.x - 0.5).toBeCloseTo(expected, 2);
    expect(result.cueEnd.y).toBeCloseTo(0.6, 6);
  });

  it('responds differently to draw and follow', () => {
    const draw = simulateShot(straight, { ...plan, topSpin: -0.8 });
    const follow = simulateShot(straight, { ...plan, topSpin: 1 });
    expect(distance(draw.cueEnd, follow.cueEnd)).toBeGreaterThan(0.1);
  });

  it('repeats the same seeded ensemble exactly', () => {
    const first = analyzeShot(straight, plan, 8);
    const second = analyzeShot(straight, plan, 8);
    expect(first.sampleEnds).toEqual(second.sampleEnds);
    expect(first.score).toBe(second.score);
    expect(first.spread).toBeGreaterThan(0);
    expect(first.potRate).toBeGreaterThan(0.5);
  });

  it('rejects a combination pot when the selected ball was not contacted first', () => {
    const scenario = { ...straight, balls: [
      { id: 0, position: { x: 1.27, y: 0.9 } },
      { id: 1, position: { x: 1.27, y: 0.55 } },
      { id: 2, position: { x: 1.27, y: 0.3 } },
    ] };
    const result = analyzeShot(scenario, { ...plan, ballId: 2, speed: 1.5 }, 8);
    expect(result.nominal.firstContact).toBe(1);
    expect(result.nominal.potted).toContain(2);
    expect(result.potRate).toBe(0);
    expect(result.score).toBe(0);
  });

  it('penalizes missing the requested position even when the pot is easy', () => {
    const nominal = simulateShot(straight, plan);
    const near = analyzeShot(straight, { ...plan, target: nominal.cueEnd }, 8);
    const far = analyzeShot(straight, { ...plan, target: { x: 0.3, y: 1 } }, 8);
    expect(near.potRate).toBe(far.potRate);
    expect(near.score).toBeGreaterThan(far.score);
    expect(far.successRate).toBe(0);
  });
});

describe('shot-selection scoring', () => {
  it('tightens position precision as levels advance without becoming impossible', () => {
    expect(positionToleranceForLevel(1)).toBe(0.19);
    expect(positionToleranceForLevel(8)).toBeLessThan(positionToleranceForLevel(4));
    expect(positionToleranceForLevel(TOTAL_LEVELS)).toBeLessThan(positionToleranceForLevel(TOTAL_LEVELS - 1));
    expect(positionToleranceForLevel(100)).toBe(0.08);
  });
  it('scores only the offered plans and preserves the exact chosen stroke', () => {
    const scenario = generateScenario(1);
    const prepared = prepareRound(scenario);
    const option = prepared.balls[0].options[1];
    const result = analyzeRound(prepared, { ballId: option.plan.ballId, optionId: option.id }, { samples: 8 });
    expect(result.selected.plan).toEqual(option.plan);
    expect(result.candidates).toHaveLength(prepared.balls.length * 3);
    expect(result.candidates.map(candidate => candidate.plan.id).sort()).toEqual(prepared.balls.flatMap(ball => ball.options.map(finish => finish.id)).sort());
    expect(result.candidates).toContain(result.selected);
    expect(result.best.score).toBeGreaterThan(0.25);
    expect(result.best.nominal.firstContact).toBe(result.best.plan.ballId);
    expect(result.best.nominal.potted).toContain(result.best.plan.ballId);
    expect(result.best.nominal.scratch).toBe(false);
    expect(result.selected.samples).toBe(8);
    expect(result.points).toBe(pointsFor(result.selected, result.candidates));
    expect(result.points).toBe(result.scoring.qualityPoints + result.scoring.rankPoints);
    expect(result.scoring.candidateCount).toBe(result.candidates.length);
  }, 30000);
});
