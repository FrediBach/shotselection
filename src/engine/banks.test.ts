import { afterEach, describe, expect, it, vi } from 'vitest';
import * as bankRoutes from './bank-routes';
import { TABLE } from './constants';
import { distance } from './math';
import { simulateShot } from './physics';
import { prepareRound } from './preparation';
import { generateScenario } from './scenarios';
import type { Scenario, ShotPlan } from './types';

afterEach(() => vi.restoreAllMocks());

/** A moving cue centre collides with an object centre at one ball diameter.
 * Cover the target's entire angular silhouette with the union of nearer ball
 * silhouettes, including the two grazing rays. Requiring each blocker's far
 * edge to precede the target's near edge proves it is encountered first. */
function fullyOccluded(scenario: Scenario): boolean {
  const cue = scenario.balls.find(ball => ball.id === 0)!.position;
  const target = scenario.balls.find(ball => ball.id === scenario.bank!.ballId)!.position;
  const targetDistance = distance(cue, target);
  const targetAngle = Math.atan2(target.y - cue.y, target.x - cue.x);
  const targetHalfAngle = Math.asin(TABLE.ballDiameter / targetDistance);
  const shadows = scenario.balls.flatMap(ball => {
    if (ball.id === 0 || ball.id === scenario.bank!.ballId) return [];
    const blockerDistance = distance(cue, ball.position);
    if (blockerDistance + TABLE.ballDiameter >= targetDistance - TABLE.ballDiameter) return [];
    const delta = Math.atan2(ball.position.y - cue.y, ball.position.x - cue.x) - targetAngle;
    const angle = Math.atan2(Math.sin(delta), Math.cos(delta));
    const halfAngle = Math.asin(TABLE.ballDiameter / blockerDistance);
    return [[angle - halfAngle, angle + halfAngle]];
  }).sort((a, b) => a[0] - b[0]);
  let coveredUntil = -targetHalfAngle;
  for (const [start, end] of shadows) {
    if (end < coveredUntil) continue;
    if (start > coveredUntil + 1e-12) return false;
    coveredUntil = Math.max(coveredUntil, end);
    if (coveredUntil >= targetHalfAngle - 1e-12) return true;
  }
  return false;
}

describe('bank lesson layouts', () => {
  it('progresses from one-cushion escapes to a required multiple-cushion finish', () => {
    const requirements = Array.from({ length: 10 }, (_, index) => generateScenario(51 + index).bank!.minCushions);
    expect(requirements[0]).toBe(1);
    expect(requirements.at(-1)).toBeGreaterThanOrEqual(2);
    for (let index = 1; index < requirements.length; index++) expect(requirements[index]).toBeGreaterThanOrEqual(requirements[index - 1]);
  });

  it.each(Array.from({ length: 10 }, (_, index) => [0, 1, 5, 8].map(seed => [51 + index, seed])).flat())(
    'blocks every direct first-contact angle in level %i, seed %i', (level, seed) => {
      const scenario = generateScenario(level, seed);
      expect(scenario.bank).toBeDefined();
      expect(fullyOccluded(scenario)).toBe(true);
    },
  );

  it.each([
    { ballId: 0, minCushions: 1 },
    { ballId: 99, minCushions: 1 },
    { ballId: 1.5, minCushions: 1 },
    { ballId: 1, minCushions: 0 },
    { ballId: 1, minCushions: 1.5 },
    { ballId: 1, minCushions: 4 },
    { ballId: 1, minCushions: Number.NaN },
  ])('rejects an invalid bank requirement %s', bank => {
    expect(() => prepareRound({ ...generateScenario(51), bank })).toThrow(/bank lesson/);
  });

  it('rejects a bank lesson combined with an unsupported position objective', () => {
    const scenario = { ...generateScenario(51), objective: {
      kind: 'position' as const, ballId: 1, nextBallId: 2, radius: 0.15, maxCutAngle: 45,
    } };
    expect(() => prepareRound(scenario)).toThrow(/bank.*position|position.*bank/i);
  });

  it.each([57, 58, 59].flatMap(level => [0, 1, 5, 8].map(seed => [level, seed])))('screens shorter routes through cushion jaws and spin in double-bank level %i, seed %i', (level, seed) => {
    const scenario = generateScenario(level, seed);
    const cue = scenario.balls.find(ball => ball.id === 0)!.position;
    const mirrorX = cue.x > TABLE.length / 2;
    const mirrorY = cue.y > TABLE.width / 2;
    // These strokes reached the target in one bank before the extra screens:
    // a bottom side-pocket jaw, a corner jaw, and three spin-adjusted rebounds.
    const shortcuts = [
      { angle: 0.868301302867179, speed: 2.5, topSpin: -1.1, sideSpin: 0 },
      { angle: 3.787364476827695, speed: 3, topSpin: 0, sideSpin: 0 },
      { angle: 5.2752576641528615, speed: 1.5, topSpin: -1.1, sideSpin: -30 },
      { angle: 1.5489797111449675, speed: 2.5, topSpin: 0, sideSpin: 60 },
      { angle: 0.37960911230876665, speed: 3.5, topSpin: 1.05, sideSpin: 30 },
    ];
    for (const shortcut of shortcuts) {
      const plan: ShotPlan = {
        id: 'shorter-route', ballId: 1, pocketId: 1, target: cue, label: 'Shorter route', ...shortcut,
        angle: Math.atan2(Math.sin(shortcut.angle) * (mirrorY ? -1 : 1), Math.cos(shortcut.angle) * (mirrorX ? -1 : 1)),
        sideSpin: shortcut.sideSpin * (mirrorX !== mirrorY ? -1 : 1),
      };
      expect(simulateShot(scenario, plan, { record: false }).firstContact).not.toBe(1);
    }
  });

  it('keeps an impossible custom bank puzzle instead of offering an unrelated direct shot', () => {
    const scenario = { ...generateScenario(51), curriculum: undefined };
    const routes = vi.spyOn(bankRoutes, 'bankRoutesFor').mockReturnValue([]);
    expect(() => prepareRound(scenario)).toThrow(/this lesson and its objective/);
    expect(routes).toHaveBeenCalledTimes(1);
    expect(routes.mock.calls[0][0].balls).toBe(scenario.balls);
    expect(routes.mock.calls[0][0].bank).toBe(scenario.bank);
  });
});

describe('pre-contact cushion counting', () => {
  const scenario: Scenario = {
    level: 51, seed: 0, title: 'Count cue banks', description: 'Physics fixture',
    balls: [{ id: 0, position: { x: 0.5, y: 0.4 } }, { id: 1, position: { x: 0.5, y: 0.8 } }],
  };
  const plan: ShotPlan = {
    id: 'count-banks', ballId: 1, pocketId: 4, target: { x: 0.5, y: 0.7 },
    angle: -Math.PI / 2, speed: 1.6, topSpin: 1, sideSpin: 0, label: 'Count banks',
  };

  it('counts cue cushion impacts before first object contact in full and lightweight simulations', () => {
    const full = simulateShot(scenario, plan);
    expect(full.firstContact).toBe(1);
    expect(full.cueBanksBeforeContact).toBe(1);
    expect(full.soundEvents.findIndex(event => event.type === 'cushion')).toBeLessThan(full.soundEvents.findIndex(event => event.type === 'ball'));
    for (const recordPaths of [false, true]) {
      const trial = simulateShot(scenario, plan, { record: false, recordPaths });
      expect(trial.cueBanksBeforeContact).toBe(full.cueBanksBeforeContact);
      expect(trial.firstContact).toBe(full.firstContact);
      expect(trial.cueEnd).toEqual(full.cueEnd);
    }
  });

  it('does not count cushions reached after a direct first contact', () => {
    const direct = { ...scenario, balls: [
      { id: 0, position: { x: 0.5, y: 0.6 } },
      { id: 1, position: { x: 1, y: 0.64 } },
    ] };
    const result = simulateShot(direct, { ...plan, angle: 0, speed: 2.5 });
    expect(result.firstContact).toBe(1);
    expect(result.soundEvents.some(event => event.type === 'cushion')).toBe(true);
    expect(result.cueBanksBeforeContact).toBe(0);
  });
});
