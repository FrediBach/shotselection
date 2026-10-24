import { describe, expect, it } from 'vitest';
import { TABLE } from './constants';
import { generateScenario } from './scenarios';
import { prepareRound } from './preparation';
import { simulateShot } from './physics';
import { analyzeShot } from './analysis';
import { PREMADE_CHARACTERS } from './characters';
import { distance, dot, normalize, subtract } from './math';
import { centeredCueReference, directShotGeometry, objectLineError, supportsGeometryComparison } from './shot-geometry';

const reflections = [0, 1, 5, 8];
describe('everyday geometry learning contrasts', () => {
  it.each([12, 13, 14].flatMap(level => reflections.map(seed => [level, seed])))('preserves both authored potting routes in level %i, seed %i', (level, seed) => {
    const scenario = generateScenario(level, seed);
    const prepared = prepareRound(scenario, { regenerate: false });
    expect(prepared.scenario.balls).toEqual(scenario.balls);
    expect(prepared.balls.map(ball => ball.ballId)).toEqual([1, 2]);
    expect(supportsGeometryComparison(prepared)).toBe(true);
    for (const ball of prepared.balls) {
      const required = scenario.curriculum!.learning!.pockets!.find(route => route.ballId === ball.ballId)!;
      for (const option of ball.options) {
        expect(option.plan.pocketId).toBe(required.pocketId);
        const g = directShotGeometry(scenario, option.plan);
        const actual = simulateShot(scenario, option.plan, { record: false });
        expect(actual.stopped).toBe(true);
        expect(actual.firstContact).toBe(ball.ballId);
        expect(actual.scratch).toBe(false);
        expect(actual.potted).toContain(ball.ballId);
        const potted = actual.finalBalls.find(candidate => candidate.id === ball.ballId)!;
        expect(distance(potted.position, g.pocket.center)).toBeLessThan(g.pocket.radius);
        expect(Math.abs(Math.atan2(g.ghost.y - g.cue.y, g.ghost.x - g.cue.x) - option.plan.angle)).toBeLessThan(1e-8);
      }
    }
  });

  it.each(reflections)('isolates object travel while matching approaches and cuts, reflection %i', seed => {
    const p = prepareRound(generateScenario(12, seed), { regenerate: false });
    const [a, b] = p.balls.map(ball => directShotGeometry(p.scenario, ball.options[0].plan));
    expect(Math.abs(a.cueDistance - b.cueDistance)).toBeLessThan(.002);
    expect(Math.abs(a.cutDegrees - b.cutDegrees)).toBeLessThan(3);
    expect(b.objectDistance / a.objectDistance).toBeGreaterThan(2.3);
    for (const g of [a, b]) {
      const error = objectLineError(g);
      const actualDirection = normalize(subtract(error.endpoint, g.object));
      expect(Math.acos(dot(g.direction, actualDirection)) * 180 / Math.PI).toBeCloseTo(1, 8);
      expect(dot(g.direction, subtract(error.endpoint, g.pocket.center))).toBeCloseTo(0, 10);
      expect(distance(error.endpoint, g.pocket.center)).toBeCloseTo(error.displacement, 10);
    }
    expect(objectLineError(b).displacement / objectLineError(a).displacement).toBeCloseTo(b.objectDistance / a.objectDistance, 10);
  });

  it.each(reflections)('changes only the cue in the centered comparison, reflection %i', seed => {
    const p = prepareRound(generateScenario(13, seed), { regenerate: false });
    const reference = centeredCueReference(p.scenario);
    expect(reference.balls.slice(1)).toEqual(p.scenario.balls.slice(1));
    const actual = p.balls.map(ball => directShotGeometry(p.scenario, ball.options[0].plan));
    const centered = p.balls.map(ball => directShotGeometry(reference, ball.options[0].plan));
    expect(centered[0].cutDegrees).toBeCloseTo(centered[1].cutDegrees, 8);
    expect(actual[0].cutDegrees - actual[1].cutDegrees).toBeGreaterThan(7);
    expect(actual[0].objectDistance).toBeCloseTo(actual[1].objectDistance, 8);
    for (let i = 0; i < 2; i++) {
      expect(actual[i].ghost).toEqual(centered[i].ghost);
      expect(actual[i].pocket).toEqual(centered[i].pocket);
      expect(Math.abs(actual[i].cutDegrees - centered[i].cutDegrees)).toBeGreaterThan(2);
    }
  });

  it.each(reflections)('distinguishes entry angle from cut and projects the physical mouth, reflection %i', seed => {
    const p = prepareRound(generateScenario(14, seed), { regenerate: false });
    const [side, corner] = p.balls.map(ball => directShotGeometry(p.scenario, ball.options[0].plan));
    expect(side.pocket.kind).toBe('side');
    expect(corner.pocket.kind).toBe('corner');
    expect(side.entryDegrees).toBeGreaterThan(35);
    expect(corner.entryDegrees).toBeLessThan(.001);
    expect(side.cutDegrees).toBeLessThan(corner.cutDegrees);
    expect(distance(...side.pocket.mouth)).toBeGreaterThan(distance(...corner.pocket.mouth));
    expect(side.projectedClearance).toBeLessThan(corner.projectedClearance - .01);
    const transverse = { x: -side.direction.y, y: side.direction.x };
    expect(side.projectedClearance).toBeCloseTo(Math.abs(dot(subtract(side.pocket.mouth[1], side.pocket.mouth[0]), transverse)) - TABLE.ballDiameter, 10);
  });

  it('rejects a partial offering and geometry that loses the intended contrast', () => {
    for (const level of [12, 13, 14]) {
      const prepared = prepareRound(generateScenario(level, 0), { regenerate: false });
      expect(supportsGeometryComparison({ ...prepared, balls: prepared.balls.slice(0, 1) })).toBe(false);
    }
    const symmetric = prepareRound(generateScenario(13, 0), { regenerate: false });
    expect(supportsGeometryComparison({ ...symmetric, scenario: centeredCueReference(symmetric.scenario) })).toBe(false);
    expect(() => prepareRound(centeredCueReference(symmetric.scenario), { regenerate: false })).toThrow(/No feasible/);
  });

  it('reflects the assigned pockets when replacing a layout that lost its comparison', () => {
    const original = generateScenario(13, 0);
    const prepared = prepareRound(centeredCueReference(original));
    expect(prepared.scenario.seed).not.toBe(original.seed);
    const regenerated = generateScenario(13, prepared.scenario.seed);
    expect(prepared.scenario.curriculum!.learning!.pockets).toEqual(regenerated.curriculum!.learning!.pockets);
    expect(prepared.scenario.balls).toEqual(regenerated.balls);
    expect(supportsGeometryComparison(prepared)).toBe(true);
  });

  it.each([12, 13, 14])('keeps both alternatives playable at level %i for every preset and reflection', level => {
    for (const seed of reflections) {
      const prepared = prepareRound(generateScenario(level, seed), { regenerate: false });
      for (const character of PREMADE_CHARACTERS) for (const ball of prepared.balls) {
        expect(ball.options.some(option => analyzeShot(prepared.scenario, option.plan, 32, character.talents).successRate > 0)).toBe(true);
      }
    }
  }, 30000);
});
