import { describe, expect, it } from 'vitest';
import { TABLE } from './constants';
import { distance, dot, normalize, segmentDistance, subtract } from './math';
import { simulateShot } from './physics';
import { CUSHIONS, isPocketed, POCKET_GEOMETRY } from './table-geometry';
import type { Scenario, ShotPlan, Vec2 } from './types';

const stroke: ShotPlan = { id: 'geometry', ballId: 1, pocketId: 0, angle: 0, speed: 0.65, topSpin: 1, sideSpin: 0, target: { x: 1, y: 0.6 }, label: 'Geometry fixture' };
const scenarioAt = (position: Vec2): Scenario => ({ level: 1, seed: 42, title: 'Pocket geometry', description: 'Test', balls: [{ id: 0, position }] });
const toward = (a: Vec2, b: Vec2) => Math.atan2(b.y - a.y, b.x - a.x);

describe('shared pocket mouths and slate shelves', () => {
  it.each(POCKET_GEOMETRY)('$name has the specified mouth and a recessed well', pocket => {
    const shelf = pocket.kind === 'corner' ? TABLE.cornerShelf : TABLE.sideShelf;
    expect(distance(...pocket.mouth)).toBeCloseTo(pocket.kind === 'corner' ? TABLE.cornerMouth : TABLE.sideMouth, 12);
    expect(distance(pocket.center, pocket.mouthCenter) - pocket.radius).toBeCloseTo(shelf, 12);
    expect(isPocketed(pocket.mouthCenter)).toBe(false);
    const beforeDrop = { x: pocket.mouthCenter.x + pocket.outward.x * shelf / 2, y: pocket.mouthCenter.y + pocket.outward.y * shelf / 2 };
    expect(isPocketed(beforeDrop)).toBe(false);
  });

  for (const speed of [0.65, 4]) {
    it.each(POCKET_GEOMETRY)(`captures a ${speed} m/s centre entry into $name inside its visible well`, pocket => {
      const start = { x: pocket.mouthCenter.x - pocket.outward.x * 0.3, y: pocket.mouthCenter.y - pocket.outward.y * 0.3 };
      const result = simulateShot(scenarioAt(start), { ...stroke, pocketId: pocket.id, speed, angle: Math.atan2(pocket.outward.y, pocket.outward.x) });
      expect(result.potted).toEqual([0]);
      expect(result.scratch).toBe(true);
      expect(result.stopped).toBe(true);
      expect(result.soundEvents.map(event => event.type)).toEqual(['cue', 'pocket']);
      expect(distance(result.cueEnd, pocket.center)).toBeLessThan(pocket.radius);
      const shelf = pocket.kind === 'corner' ? TABLE.cornerShelf : TABLE.sideShelf;
      expect(dot(subtract(result.cueEnd, pocket.mouthCenter), pocket.outward)).toBeGreaterThanOrEqual(shelf);
      expect(result.cuePath.at(-1)).toEqual(result.cueEnd);
      expect(result.cuePath.slice(0, -1).every(point => !isPocketed(point))).toBe(true);
    });
  }

  it.each(POCKET_GEOMETRY)('allows a slow ball to stop on the $name shelf without inventing a pot', pocket => {
    const shelf = pocket.kind === 'corner' ? TABLE.cornerShelf : TABLE.sideShelf;
    const start = { x: pocket.mouthCenter.x - pocket.outward.x * 0.04, y: pocket.mouthCenter.y - pocket.outward.y * 0.04 };
    const speed = Math.sqrt(2 * TABLE.rollingFriction * 9.80665 * (0.04 + shelf / 2));
    const result = simulateShot(scenarioAt(start), { ...stroke, speed, angle: Math.atan2(pocket.outward.y, pocket.outward.x) });
    const depth = dot(subtract(result.cueEnd, pocket.mouthCenter), pocket.outward);
    expect(result.stopped).toBe(true);
    expect(result.scratch).toBe(false);
    expect(result.potted).toEqual([]);
    expect(depth).toBeGreaterThan(0);
    expect(depth).toBeLessThan(shelf);
  });
});

describe('angled pocket-facing collisions', () => {
  it.each([-1, 1])('deflects the side-pocket jaw on side %s without dropping through its facing', sign => {
    const mirror = (p: Vec2): Vec2 => ({ x: TABLE.length / 2 + sign * (p.x - TABLE.length / 2), y: p.y });
    const start = mirror({ x: 1, y: 0.14 });
    const target = mirror({ x: 1.355, y: -0.03 });
    const scenario = scenarioAt(start);
    const plan = { ...stroke, angle: toward(start, target) };
    const result = simulateShot(scenario, plan);
    const hit = result.soundEvents.find(event => event.type === 'cushion')!;
    expect(hit).toBeDefined();
    const impact = simulateShot(scenario, plan, { maxTime: hit.time - 1e-8 }).cueEnd;
    const jaw = sign === 1 ? CUSHIONS[1].jaws[0] : CUSHIONS[0].jaws[1];
    // This contact is beyond the nose, so a straight-ended cushion cannot pass.
    expect(impact.y).toBeLessThan(-0.003);
    expect(segmentDistance(impact, jaw.a, jaw.b)).toBeCloseTo(TABLE.ballRadius, 4);
    expect(result.potted).toEqual([]);
    expect(result.scratch).toBe(false);
    expect(result.stopped).toBe(true);
  });

  it.each([false, true])('reflects off an angled corner jaw (swap axes: %s) before dropping', swap => {
    const transform = (p: Vec2): Vec2 => swap ? { x: p.y, y: p.x } : p;
    const start = transform({ x: 0.12, y: 0.1 });
    const target = transform({ x: 0, y: -0.05 });
    const scenario = scenarioAt(start);
    const plan = { ...stroke, angle: toward(start, target) };
    const result = simulateShot(scenario, plan);
    expect(result.soundEvents.map(event => event.type)).toEqual(['cue', 'cushion', 'pocket']);
    const hit = result.soundEvents[1];
    const impact = simulateShot(scenario, plan, { maxTime: hit.time - 1e-8 }).cueEnd;
    const following = simulateShot(scenario, plan, { maxTime: hit.time + TABLE.step - 1e-8 }).cueEnd;
    const cushion = swap ? CUSHIONS[4] : CUSHIONS[0];
    const jaw = cushion.jaws[0];
    expect(segmentDistance(impact, cushion.nose.a, cushion.nose.b)).toBeGreaterThan(TABLE.ballRadius + 0.004);
    expect(segmentDistance(impact, jaw.a, jaw.b)).toBeCloseTo(TABLE.ballRadius, 4);
    const tangent = normalize(subtract(jaw.b, jaw.a));
    const normal = swap ? { x: -tangent.y, y: tangent.x } : { x: tangent.y, y: -tangent.x };
    expect(dot(subtract(target, start), normal)).toBeLessThan(0);
    expect(dot(subtract(following, impact), normal)).toBeGreaterThan(0);
    expect(isPocketed(impact)).toBe(false);
    expect(isPocketed(result.cueEnd)).toBe(true);
  });

  it('does not tunnel through a closed cushion at the maximum stroke speed', () => {
    const result = simulateShot(scenarioAt({ x: 0.6, y: 0.12 }), { ...stroke, angle: -Math.PI / 2, speed: 4 }, { maxTime: 0.12 });
    expect(result.potted).toEqual([]);
    expect(result.soundEvents.map(event => event.type)).toEqual(['cue', 'cushion']);
    expect(result.cueEnd.y).toBeGreaterThan(0.12);
    expect(result.cuePath.every(point => point.y >= TABLE.ballRadius - 0.001)).toBe(true);
  });

  it('does not count a location outside the table as a pocket', () => {
    const result = simulateShot(scenarioAt({ x: -0.13, y: 0.6 }), { ...stroke, angle: Math.PI, speed: 0.05 });
    expect(result.stopped).toBe(true);
    expect(result.potted).toEqual([]);
    expect(result.scratch).toBe(false);
    expect(result.soundEvents.map(event => event.type)).toEqual(['cue']);
  });
});
