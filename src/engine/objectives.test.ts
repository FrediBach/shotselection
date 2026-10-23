import { afterEach, describe, expect, it, vi } from 'vitest';
import { analyzeShot } from './analysis';
import { TABLE } from './constants';
import { distance } from './math';
import { directNextShotRoutes, directShotRoutes, evaluateShotObjective, hasProvenNextShot } from './objectives';
import * as physics from './physics';
import { prepareRound } from './preparation';
import { analyzeShotTolerance } from './tolerance';
import type { Ball, Scenario, ShotPlan, Simulation } from './types';

const nextBalls: Ball[] = [
  { id: 0, position: { x: 1.27, y: 0.85 } },
  { id: 2, position: { x: 1.27, y: 0.3 } },
];
const scenario: Scenario = {
  level: 10, seed: 77, title: 'Leave the next ball', description: 'Pot 1 for a clear shot at 2.',
  objective: { kind: 'position', ballId: 1, nextBallId: 2, radius: 0.11, maxCutAngle: 32, target: nextBalls[0].position },
  balls: [...nextBalls, { id: 1, position: { x: 0.5, y: 0.3 } }],
};
const plan: ShotPlan = { id: 'first', ballId: 1, pocketId: 0, target: { x: 2, y: 0.8 }, angle: 0, speed: 1.2, topSpin: 0, sideSpin: 0, label: 'A' };
const simulation: Simulation = {
  frames: [], finalBalls: nextBalls.map(ball => ({ ...ball, pocketed: false })), soundEvents: [], cuePath: [], objectPath: [],
  cueEnd: nextBalls[0].position, potted: [1], scratch: false, firstContact: 1, duration: 2, stopped: true,
};

afterEach(() => vi.restoreAllMocks());

describe('direct next-ball routes', () => {
  it('aims at the ghost ball and applies the cut limit to that incoming line', () => {
    const routes = directShotRoutes(nextBalls, 2, 32);
    expect(routes).toHaveLength(1);
    expect(routes[0].pocketId).toBe(1);
    expect(routes[0].ghost.y).toBeCloseTo(0.3 + TABLE.ballDiameter, 8);
    expect(routes[0].cutAngle).toBeCloseTo(0, 8);
    // A center-to-center line gives 30.2°, but the actual ghost-ball cut is 33°.
    const angled = [{ id: 0, position: { x: 1.59, y: 0.85 } }, nextBalls[1]];
    expect(directShotRoutes(angled, 2, 32)).toHaveLength(0);
    expect(directShotRoutes(angled, 2, 35).some(route => route.pocketId === 1)).toBe(true);
  });

  it.each([{ x: 1.27, y: 0.6 }, { x: 1.27, y: 0.15 }])('rejects a blocker in either swept path at %s', position => {
    const blocked = { ...simulation, finalBalls: [...simulation.finalBalls, { id: 3, position, pocketed: false }] };
    expect(directNextShotRoutes(scenario, blocked)).toHaveLength(0);
    const moved = { ...blocked, finalBalls: blocked.finalBalls.map(ball => ball.id === 3 ? { ...ball, position: { x: 1.8, y: 0.6 } } : ball) };
    expect(directNextShotRoutes(scenario, moved)).toHaveLength(1);
  });

  it('uses the surviving next ball at its final position and requires a settled cue ball', () => {
    expect(directNextShotRoutes(scenario, { ...simulation, finalBalls: simulation.finalBalls.map(ball => ball.id === 2 ? { ...ball, pocketed: true } : ball) })).toHaveLength(0);
    expect(directNextShotRoutes(scenario, { ...simulation, finalBalls: simulation.finalBalls.map(ball => ball.id === 2 ? { ...ball, position: { x: 0.2, y: 0.85 } } : ball) })).toHaveLength(0);
    expect(directNextShotRoutes(scenario, { ...simulation, stopped: false })).toHaveLength(0);
    expect(directNextShotRoutes(scenario, { ...simulation, scratch: true })).toHaveLength(0);
  });
});

describe('one position objective across scoring and tolerance', () => {
  it('uses the shared zone even when the option marker is somewhere else', () => {
    vi.spyOn(physics, 'simulateShot').mockReturnValue(simulation);
    const analysis = analyzeShot(scenario, plan, 8);
    const tolerance = analyzeShotTolerance(scenario, plan);
    expect(analysis.successRate).toBe(1);
    expect(analysis.nextShotRate).toBe(1);
    expect(analysis.positionRate).toBe(1);
    expect(tolerance.nominalSuccess).toBe(true);
    expect(tolerance.positionTolerance).toBe(0.11);
    expect(tolerance.volume.successCount).toBe(441);
  });

  it('rejects a legal pot in the zone when the next-ball route is blocked', () => {
    const blocked = { ...simulation, finalBalls: [...simulation.finalBalls, { id: 3, position: { x: 1.27, y: 0.6 }, pocketed: false }] };
    vi.spyOn(physics, 'simulateShot').mockReturnValue(blocked);
    const analysis = analyzeShot(scenario, plan, 8);
    const tolerance = analyzeShotTolerance(scenario, plan);
    expect(analysis.potRate).toBe(1);
    expect(analysis.positionRate).toBe(1);
    expect(analysis.nextShotRate).toBe(0);
    expect(analysis.successRate).toBe(0);
    expect(analysis.score).toBeCloseTo(0.08);
    expect(tolerance.nominalPot).toBe(true);
    expect(tolerance.nominalSuccess).toBe(false);
    expect(tolerance.volume.potCount).toBe(441);
    expect(tolerance.volume.successCount).toBe(0);
  });

  it('does not substitute a route for the landing zone or permit the reserved ball as the first shot', () => {
    expect(evaluateShotObjective({ ...scenario, objective: { ...scenario.objective!, target: { x: 2.1, y: 1 } } }, plan, simulation).success).toBe(false);
    expect(evaluateShotObjective(scenario, { ...plan, ballId: 2 }, { ...simulation, potted: [2], firstContact: 2 }).legalPot).toBe(false);
    expect(() => evaluateShotObjective({ ...scenario, objective: { ...scenario.objective!, target: undefined } }, plan, simulation)).toThrow(/prepared landing zone/);
  });
});

describe('preparing a position lesson', () => {
  const layout: Scenario = {
    level: 7, seed: 273, title: 'Make the next shot', description: 'Choose a useful leave.',
    objective: { kind: 'position', ballId: 1, nextBallId: 2, radius: 0.16, maxCutAngle: 60 },
    curriculum: { chapterId: 'position', chapterTitle: 'Position play', chapterIndex: 2, lessonIndex: 1, lessonCount: 3, lesson: 'Leave a clear angle.', takeaway: 'Plan the second shot first.' },
    balls: [
      { id: 0, position: { x: 0.73, y: 0.83 } },
      { id: 1, position: { x: 1.16, y: 0.33 } },
      { id: 2, position: { x: 1.84, y: 0.39 } },
    ],
  };

  it('offers three legal first pots, reserves the next ball, and proves an achievable shared zone', () => {
    const prepared = prepareRound(layout);
    expect(prepared.balls.map(ball => ball.ballId)).toEqual([1]);
    expect(prepared.scenario.objective?.target).toBeDefined();
    expect(prepared.scenario.curriculum).toEqual(layout.curriculum);
    let proven = 0;
    for (const option of prepared.balls[0].options) {
      const result = physics.simulateShot(prepared.scenario, option.plan, { record: false });
      const outcome = evaluateShotObjective(prepared.scenario, option.plan, result);
      expect(outcome.legalPot).toBe(true);
      expect(distance(result.cueEnd, option.plan.target)).toBeLessThan(1e-9);
      if (outcome.success && hasProvenNextShot(prepared.scenario, result)) proven++;
    }
    expect(proven).toBeGreaterThan(0);
    expect(prepareRound(prepared.scenario).scenario.objective?.target).toEqual(prepared.scenario.objective?.target);
  }, 30000);

  it('keeps a supplied zone and the original lesson through replacement layouts', () => {
    const first = prepareRound(layout);
    const simulate = physics.simulateShot;
    vi.spyOn(physics, 'simulateShot').mockImplementation((attempt, shot, options) => attempt.seed === layout.seed
      ? { ...simulation, potted: [], firstContact: null }
      : simulate(attempt, shot, options));
    const prepared = prepareRound({ ...layout, objective: first.scenario.objective });
    expect(prepared.scenario.objective).toEqual(first.scenario.objective);
    expect(prepared.scenario.curriculum).toEqual(layout.curriculum);
    expect(prepared.scenario.title).toBe(layout.title);
    expect(prepared.balls.map(ball => ball.ballId)).toEqual([1]);
    expect(prepared.balls[0].options.some(option => evaluateShotObjective(prepared.scenario, option.plan, physics.simulateShot(prepared.scenario, option.plan, { record: false })).success)).toBe(true);
  }, 30000);

  it('rejects impossible objective metadata instead of quietly offering a free-choice round', () => {
    expect(() => prepareRound({ ...layout, objective: { ...layout.objective!, nextBallId: 1 } })).toThrow(/distinct object balls/);
    expect(() => prepareRound({ ...layout, objective: { ...layout.objective!, target: { x: -1, y: 0.5 } } })).toThrow(/zone on the table/);
    expect(() => prepareRound({ ...layout, balls: layout.balls.filter(ball => ball.id !== 2) })).toThrow(/reserved next ball/);
  });

  it.each([true, false])('never replaces a custom position puzzle with an easier layout (fixed target: %s)', fixedTarget => {
    const first = prepareRound(layout);
    const simulate = vi.spyOn(physics, 'simulateShot').mockReturnValue({ ...simulation, potted: [], firstContact: null });
    const fixed = { ...first.scenario, curriculum: undefined, objective: { ...first.scenario.objective!, target: fixedTarget ? first.scenario.objective!.target : undefined } };
    expect(() => prepareRound(fixed)).toThrow(/this lesson and its objective/);
    expect(simulate.mock.calls.every(([attempt]) => attempt.balls === fixed.balls && attempt.objective === fixed.objective)).toBe(true);
  });
});
