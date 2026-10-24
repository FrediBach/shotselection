import { expect, it } from 'vitest';
import { generateScenario } from './scenarios';
import { prepareRound } from './preparation';
import { ballWidthEvidence, WIDTH_CUT_LIMIT } from './ball-width';
import { directShotRoutes } from './objectives';
import { TABLE } from './constants';
import { distance, segmentDistance } from './math';
import { secondShotPotted } from './second-shot';
import { simulateShot } from './physics';
import { analyzeRound } from './analysis';
import { PREMADE_CHARACTERS } from './characters';

it.each([0, 1, 5, 8, 41 * 919])('illustrates a clear center line with physical overlap versus a wide proven route, seed %i', seed => {
  const source = generateScenario(41, seed), before = structuredClone(source);
  const p = prepareRound(source, { regenerate: false }), e = ballWidthEvidence(p.scenario)!;
  expect(p.scenario.balls).toEqual(source.balls); expect(e).not.toBeNull();
  expect(e.ballId).toBe(2); expect(e.obstruction.blocker.id).toBe(5);
  expect(e.narrow.pocket.id).not.toBe(e.wide.pocket.id);
  expect(e.narrow.minimum).toBeGreaterThan(TABLE.ballRadius + .005);
  expect(e.narrow.minimum).toBeLessThan(TABLE.ballDiameter - .005);
  expect(e.wide.minimum).toBeGreaterThanOrEqual(TABLE.ballDiameter + .025);
  expect(e.narrow.clearances.filter(c => c.distance < TABLE.ballDiameter)).toHaveLength(1);
  expect(segmentDistance(e.closest, e.obstruction.start, e.obstruction.end)).toBeLessThan(1e-9);
  expect(distance(e.closest, e.obstruction.blocker.position)).toBeCloseTo(e.obstruction.distance, 9);
  for (const c of [e.narrow, e.wide]) {
    expect(c.clearances).toHaveLength((source.balls.length - 2) * 2);
    expect(c.route.cutAngle).toBeLessThanOrEqual(WIDTH_CUT_LIMIT);
    for (const clearance of c.clearances) expect(clearance.distance).toBeGreaterThan(TABLE.ballRadius);
  }
  const actual = directShotRoutes(source.balls, e.ballId, WIDTH_CUT_LIMIT);
  expect(actual.some(r => r.pocketId === e.narrow.pocket.id)).toBe(false);
  expect(actual.some(r => r.pocketId === e.wide.pocket.id)).toBe(true);
  const removed = source.balls.filter(b => b.id !== e.obstruction.blocker.id);
  expect(directShotRoutes(removed, e.ballId, WIDTH_CUT_LIMIT).find(r => r.pocketId === e.narrow.pocket.id)).toEqual(e.narrow.route);
  expect(secondShotPotted(e.ballId, e.simulation)).toBe(true);
  expect(e.plan.pocketId).toBe(e.wide.pocket.id);
  expect(simulateShot(source, e.plan, { record: false, recordPaths: true })).toEqual(e.simulation);
  expect(source).toEqual(before);
  for (const character of PREMADE_CHARACTERS) {
    const options = p.balls.find(b => b.ballId === e.ballId)!.options;
    const result = analyzeRound(p, { ballId: e.ballId, optionId: options[0].id }, { samples: 32, talents: character.talents });
    expect(result.candidates.some(c => c.successRate > 0)).toBe(true);
  }
}, 30000);

it('does not invent a width obstruction when the blocker or cue is absent', () => {
  const source = generateScenario(41, 0);
  expect(ballWidthEvidence({ ...source, balls: source.balls.filter(b => b.id !== 0) })).toBeNull();
  expect(ballWidthEvidence({ ...source, balls: source.balls.filter(b => b.id !== 5) })).toBeNull();
  expect(ballWidthEvidence({ ...source, balls: source.balls.filter(b => b.id <= 1) })).toBeNull();
});
