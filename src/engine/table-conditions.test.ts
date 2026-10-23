import { Body, Sphere } from 'cannon-es';
import { describe, expect, it } from 'vitest';
import { TABLE } from './constants';
import { applyCloth, resolveRails, simulateShot } from './physics';
import { clothFrictionAt, reflectTableConditions } from './table-conditions';
import type { Scenario, ShotPlan, TableConditions } from './types';

const scenario: Scenario = {
  level: 101, seed: 1, title: 'Condition test', description: 'Isolated physical fixture',
  balls: [{ id: 0, position: { x: 0.5, y: 0.6 } }],
};
const plan: ShotPlan = {
  id: 'test', ballId: 1, pocketId: 2, target: { x: 1.5, y: 0.6 },
  angle: 0, speed: 0.3, topSpin: 1, sideSpin: 0, label: 'Roll',
};
const condition = (defects: Partial<TableConditions>): TableConditions => ({ id: 'test', name: 'Test', description: 'A repeatable defect', ...defects });
const simulate = (defects: Partial<TableConditions>, shot = plan, layout = scenario) => simulateShot({ ...layout, conditions: condition(defects) }, shot);

describe('broken table physics', () => {
  it('keeps an explicitly clean table identical to the ordinary simulation', () => {
    expect(simulate({})).toEqual(simulateShot(scenario, plan));
  });

  it('halves the rolling stopping distance on cloth with twice the drag', () => {
    const clean = simulateShot(scenario, plan);
    const slow = simulate({ cloth: 2 });
    expect(slow.stopped).toBe(true);
    expect(slow.cueEnd.x - 0.5).toBeCloseTo((clean.cueEnd.x - 0.5) / 2, 2);
    expect(slow.cueEnd.y).toBe(0.6);
  });

  it('applies a sticky patch only along the ball route', () => {
    const onRoute = { id: 'sticky', center: { x: 0.7, y: 0.6 }, radius: 0.12, friction: 3 };
    const clean = simulateShot(scenario, plan);
    const hit = simulate({ patches: [onRoute] });
    const miss = simulate({ patches: [{ ...onRoute, center: { x: 0.7, y: 1 } }] });
    expect(hit.cueEnd.x).toBeLessThan(clean.cueEnd.x - 0.1);
    expect(miss.cueEnd).toEqual(clean.cueEnd);
    expect(clothFrictionAt(onRoute.center, condition({ cloth: 1.5, patches: [onRoute] }))).toBe(4.5);
  });

  it('curves moving balls with a slate lean while resting balls stay still', () => {
    const layout = { ...scenario, balls: [...scenario.balls, { id: 2, position: { x: 1.8, y: 1 } }] };
    const result = simulate({ nap: { x: 0, y: 0.04 } }, { ...plan, speed: 0.45 }, layout);
    expect(result.stopped).toBe(true);
    expect(result.cueEnd.y).toBeGreaterThan(0.7);
    expect(result.finalBalls.find(ball => ball.id === 2)?.position).toEqual({ x: 1.8, y: 1 });
    const resting = new Body({ mass: TABLE.ballMass, shape: new Sphere(TABLE.ballRadius) });
    applyCloth(resting, TABLE.step, condition({ nap: { x: 100, y: 100 } }));
    expect(resting.velocity.length()).toBe(0);
  });

  it('limits even extreme slopes below drag and reaches a settled endpoint', () => {
    const result = simulate({ nap: { x: 10, y: 10 } });
    expect(result.stopped).toBe(true);
    expect(result.duration).toBeLessThan(15);
    expect(result.cueEnd.x).toBeGreaterThan(0.5);
  });

  it('reduces restitution only on the damaged cushion, including its jaws', () => {
    const rebound = (side: 'top' | 'bottom', restitution: number) => {
      const body = new Body({ mass: TABLE.ballMass, shape: new Sphere(TABLE.ballRadius) });
      body.position.set(0.5, TABLE.ballRadius - 0.001, 0);
      body.velocity.set(0, -1, 0);
      resolveRails(body, condition({ cushions: [{ rail: side, restitution }] }));
      return body.velocity.y;
    };
    expect(rebound('top', 0.35)).toBeCloseTo(0.35, 12);
    expect(rebound('bottom', 0.35)).toBeCloseTo(TABLE.cushionRestitution, 12);
    const jawSpeed = (restitution: number) => {
      const body = new Body({ mass: TABLE.ballMass, shape: new Sphere(TABLE.ballRadius) });
      // The top right jaw of the top-left cushion faces into the middle pocket.
      body.position.set(TABLE.length / 2 - TABLE.sideMouth / 2 + 0.02, -0.008, 0);
      body.velocity.set(-1, 0, 0);
      expect(resolveRails(body, condition({ cushions: [{ rail: 'top', restitution }] }))).toBeGreaterThan(0);
      return body.velocity.length();
    };
    expect(jawSpeed(0.35)).toBeLessThan(jawSpeed(TABLE.cushionRestitution));
  });

  it('applies weak cue power, bent aim, and poor spin as fixed stroke defects', () => {
    const defects = { cue: { power: 0.75, angleBias: 0.08, spin: 0.6 } };
    const result = simulate(defects, { ...plan, topSpin: -0.4, sideSpin: 8 });
    const effective = simulateShot(scenario, { ...plan, speed: plan.speed * 0.75, angle: 0.08, topSpin: -0.24, sideSpin: 4.8 });
    expect(result.finalBalls).toEqual(effective.finalBalls);
    expect(result.cueEnd.y).toBeGreaterThan(0.6);
    expect(result.cueEnd.x).toBeLessThan(simulateShot(scenario, plan).cueEnd.x);
  });

  it('makes dirty ball contacts lose more speed and changes cut-ball throw', () => {
    const layout = { ...scenario, balls: [scenario.balls[0], { id: 1, position: { x: 0.8, y: 0.625 } }] };
    const clean = simulate({}, { ...plan, speed: 0.7 }, layout);
    // Cancel the dirt's rolling-drag change to isolate ball-contact response.
    const dirty = simulate({ dirt: 1, cloth: 1 / 1.15 }, { ...plan, speed: 0.7 }, layout);
    expect(clean.firstContact).toBe(1);
    expect(dirty.firstContact).toBe(1);
    const start = layout.balls[1].position;
    const cleanEnd = clean.finalBalls[1].position;
    const dirtyEnd = dirty.finalBalls[1].position;
    expect(Math.hypot(dirtyEnd.x - start.x, dirtyEnd.y - start.y)).toBeLessThan(Math.hypot(cleanEnd.x - start.x, cleanEnd.y - start.y));
    expect(Math.abs(Math.atan2(dirtyEnd.y - start.y, dirtyEnd.x - start.x) - Math.atan2(cleanEnd.y - start.y, cleanEnd.x - start.x))).toBeGreaterThan(0.005);
  });

  it('uses identical defect physics for replay, path-only and compact trials', () => {
    const layout = { ...scenario, conditions: condition({ cloth: 1.4, nap: { x: 0.015, y: 0.025 }, dirt: 0.6, cue: { power: 0.8, angleBias: 0.01, spin: 0.8 }, patches: [{ id: 'patch', center: { x: 0.7, y: 0.6 }, radius: 0.1, friction: 2.5 }], cushions: [{ rail: 'right', restitution: 0.4 }] }), balls: [scenario.balls[0], { id: 1, position: { x: 0.9, y: 0.62 } }] };
    const shot = { ...plan, speed: 1.1 };
    const full = simulateShot(layout, shot);
    const paths = simulateShot(layout, shot, { record: false, recordPaths: true });
    const compact = simulateShot(layout, shot, { record: false });
    expect(full.firstContact).toBe(1);
    for (const result of [paths, compact, simulateShot(layout, shot)]) {
      expect(result.finalBalls).toEqual(full.finalBalls);
      expect(result.potted).toEqual(full.potted);
      expect(result.firstContact).toBe(full.firstContact);
      expect(result.ballContacts).toEqual(full.ballContacts);
      expect(result.duration).toBe(full.duration);
      expect(result.stopped).toBe(full.stopped);
    }
    expect(paths.cuePath).toEqual(full.cuePath);
    expect(paths.objectPath).toEqual(full.objectPath);
    expect(compact.frames).toHaveLength(0);
  });

  it('reflects all directional defects together with the layout', () => {
    const original = condition({ nap: { x: 0.03, y: -0.02 }, cue: { power: 0.8, angleBias: 0.01, spin: 0.7 }, patches: [{ id: 'patch', center: { x: 0.8, y: 0.3 }, radius: 0.1, friction: 2 }], cushions: [{ rail: 'top', restitution: 0.4 }, { rail: 'left', restitution: 0.6 }] });
    const reflected = reflectTableConditions(original, true, false);
    expect(reflected.nap).toEqual({ x: -0.03, y: -0.02 });
    expect(reflected.cue?.angleBias).toBe(-0.01);
    expect(reflected.patches?.[0].center).toEqual({ x: TABLE.length - 0.8, y: 0.3 });
    expect(reflected.cushions?.map(cushion => cushion.rail)).toEqual(['top', 'right']);
    expect(reflectTableConditions(original, true, true).cue?.angleBias).toBe(0.01);
    expect(reflectTableConditions(original, false, true).cushions?.[0].rail).toBe('bottom');
    expect(original.nap?.x).toBe(0.03);
  });

  it('preserves the same physical challenge under each table reflection', () => {
    const conditions = condition({ cloth: 1.3, nap: { x: 0.01, y: 0.02 }, cue: { power: 0.9, angleBias: 0.015, spin: 0.8 }, patches: [{ id: 'patch', center: { x: 0.7, y: 0.6 }, radius: 0.12, friction: 2.2 }] });
    const layout = { ...scenario, conditions };
    const original = simulateShot(layout, { ...plan, speed: 0.6 });
    for (const [mirrorX, mirrorY] of [[true, false], [false, true], [true, true]]) {
      const reflected = simulateShot({ ...layout,
        conditions: reflectTableConditions(conditions, mirrorX, mirrorY),
        balls: layout.balls.map(ball => ({ ...ball, position: {
          x: mirrorX ? TABLE.length - ball.position.x : ball.position.x,
          y: mirrorY ? TABLE.width - ball.position.y : ball.position.y,
        } })),
      }, { ...plan, speed: 0.6, angle: Math.atan2(Math.sin(plan.angle) * (mirrorY ? -1 : 1), Math.cos(plan.angle) * (mirrorX ? -1 : 1)) });
      expect(reflected.cueEnd.x).toBeCloseTo(mirrorX ? TABLE.length - original.cueEnd.x : original.cueEnd.x, 9);
      expect(reflected.cueEnd.y).toBeCloseTo(mirrorY ? TABLE.width - original.cueEnd.y : original.cueEnd.y, 9);
      expect(reflected.stopped).toBe(true);
    }
  });
});
