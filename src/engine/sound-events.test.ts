import { describe, expect, it } from 'vitest';
import { TABLE } from './constants';
import { simulateShot } from './physics';
import type { Scenario, ShotPlan } from './types';

const straight: Scenario = {
  level: 1, seed: 42, title: 'Straight pot', description: 'Sound fixture',
  balls: [{ id: 0, position: { x: 1.27, y: 0.85 } }, { id: 1, position: { x: 1.27, y: 0.3 } }],
};
const stroke: ShotPlan = {
  id: 'straight', ballId: 1, pocketId: 1, target: { x: 1.27, y: 0.38 },
  angle: -Math.PI / 2, speed: 1.35, topSpin: 0, sideSpin: 0, label: 'Straight pot',
};

describe('physical replay sound events', () => {
  it('records a cue strike, one ball collision and the actual pocket drop in order', () => {
    const result = simulateShot(straight, stroke);
    expect(result.soundEvents.map(event => event.type)).toEqual(['cue', 'ball', 'pocket']);
    expect(result.soundEvents[0].time).toBe(0);
    expect(result.soundEvents[1].time).toBeGreaterThan(0);
    const pocket = result.soundEvents[2];
    const dropped = result.frames.find(frame => frame.balls.find(ball => ball.id === 1)?.pocketed)!;
    expect(pocket.time).toBeGreaterThan(result.soundEvents[1].time);
    expect(dropped.time - pocket.time).toBeGreaterThanOrEqual(0);
    expect(dropped.time - pocket.time).toBeLessThanOrEqual(TABLE.step * 8);
    for (const event of result.soundEvents) {
      expect(event.time).toBeLessThanOrEqual(result.duration);
      expect(event.strength).toBeGreaterThanOrEqual(0);
      expect(event.strength).toBeLessThanOrEqual(1);
    }
  });

  it('records cushion rebounds without inventing ball collisions or drops', () => {
    const scenario = { ...straight, balls: [{ id: 0, position: { x: 0.5, y: 0.12 } }] };
    const result = simulateShot(scenario, { ...stroke, speed: 0.5, topSpin: 1 });
    expect(result.soundEvents.map(event => event.type)).toEqual(['cue', 'cushion']);
    expect(result.soundEvents[1].strength).toBeGreaterThan(0);
  });

  it('records a scratch as a single pocket sound', () => {
    const scenario = { ...straight, balls: [{ id: 0, position: { x: 1.27, y: 0.2 } }] };
    const result = simulateShot(scenario, { ...stroke, topSpin: 1 });
    expect(result.scratch).toBe(true);
    expect(result.soundEvents.map(event => event.type)).toEqual(['cue', 'pocket']);
  });

  it('omits replay sounds from ensemble trials without changing outcomes', () => {
    const full = simulateShot(straight, stroke);
    for (const recordPaths of [false, true]) {
      const trial = simulateShot(straight, stroke, { record: false, recordPaths });
      expect(trial.soundEvents).toEqual([]);
      expect(trial.cueEnd).toEqual(full.cueEnd);
      expect(trial.potted).toEqual(full.potted);
      expect(trial.firstContact).toBe(full.firstContact);
      expect(trial.duration).toBe(full.duration);
    }
  });
});
