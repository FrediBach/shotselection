import { describe, expect, it } from 'vitest';
import { analyzeShot } from './analysis';
import { TABLE } from './constants';
import { normalRandom, seededRandom } from './math';
import { simulateShot } from './physics';
import type { Scenario, ShotPlan, Vec2 } from './types';

const scenario: Scenario = {
  level: 1, seed: 42, title: 'Straight pot', description: 'All-ball endpoint fixture',
  balls: [
    { id: 0, position: { x: 1.27, y: 0.85 } },
    { id: 1, position: { x: 1.27, y: 0.3 } },
    { id: 2, position: { x: 0.7, y: 0.6 } },
    { id: 3, position: { x: 1.9, y: 0.7 } },
  ],
};
const plan: ShotPlan = {
  id: 'straight', ballId: 1, pocketId: 1, target: { x: 1.27, y: 0.38 },
  angle: -Math.PI / 2, speed: 2, topSpin: 1, sideSpin: 0, label: 'Straight pot',
};

describe('all-ball ensemble finishing positions', () => {
  it('retains every final ball and pocket flag without recording replay frames or paths', () => {
    const full = simulateShot(scenario, plan);
    expect(full.finalBalls).toEqual(full.frames.at(-1)!.balls);
    expect(full.finalBalls.map(ball => ball.id)).toEqual(scenario.balls.map(ball => ball.id));
    expect(full.finalBalls.filter(ball => ball.pocketed).map(ball => ball.id).sort()).toEqual([...full.potted].sort());
    expect(full.finalBalls.find(ball => ball.id === 0)!.pocketed).toBe(true);
    expect(full.finalBalls.find(ball => ball.id === 1)!.pocketed).toBe(true);
    expect(full.finalBalls.find(ball => ball.id === 2)!.position).toEqual(scenario.balls[2].position);
    for (const recordPaths of [false, true]) {
      const trial = simulateShot(scenario, plan, { record: false, recordPaths });
      expect(trial.frames).toEqual([]);
      expect(trial.finalBalls).toEqual(full.finalBalls);
      expect(trial.finalBalls.find(ball => ball.id === 0)!.position).toEqual(trial.cueEnd);
      expect(trial.finalBalls.find(ball => ball.id === 0)!.pocketed).toBe(trial.scratch);
    }
  });

  it('captures secondary object-ball collisions and exact endpoints at the time limit', () => {
    const combination: Scenario = { ...scenario, balls: [
      { id: 0, position: { x: 1.27, y: 0.9 } },
      { id: 1, position: { x: 1.27, y: 0.55 } },
      { id: 2, position: { x: 1.27, y: 0.3 } },
      scenario.balls[3],
    ] };
    const full = simulateShot(combination, plan);
    const trial = simulateShot(combination, plan, { record: false });
    expect(trial.finalBalls).toEqual(full.frames.at(-1)!.balls);
    expect(trial.finalBalls.find(ball => ball.id === 2)!.position).not.toEqual(combination.balls[2].position);
    const maxTime = 9 * TABLE.step;
    const limitedFull = simulateShot(combination, plan, { maxTime });
    const limitedTrial = simulateShot(combination, plan, { maxTime, record: false });
    expect(limitedTrial.stopped).toBe(false);
    expect(limitedTrial.finalBalls).toEqual(limitedFull.frames.at(-1)!.balls);
    expect(limitedTrial.finalBalls).not.toEqual(limitedFull.frames.at(-2)!.balls);
  });

  it('keeps all 64 exact seeded trials, including scratch endpoints, without changing statistical endpoints', () => {
    const result = analyzeShot(scenario, plan, 64);
    expect(result.sampleBallEnds).toHaveLength(64);
    expect(result.samplePaths).toHaveLength(24);
    expect(result.scratchRate).toBeGreaterThan(0);
    const random = seededRandom(scenario.seed ^ 0x3A7B91);
    const statisticalEnds: Vec2[] = [];
    for (let index = 0; index < 64; index++) {
      const perturbed: ShotPlan = {
        ...plan,
        angle: plan.angle + normalRandom(random) * (0.0044 + Math.abs(plan.sideSpin) * 0.000025),
        speed: plan.speed * (1 + normalRandom(random) * 0.035),
        topSpin: plan.topSpin + normalRandom(random) * 0.085,
        sideSpin: plan.sideSpin + normalRandom(random) * 3,
      };
      const replay = simulateShot(scenario, perturbed);
      const endpoints = result.sampleBallEnds[index];
      expect(endpoints).toEqual(replay.frames.at(-1)!.balls);
      expect(endpoints.map(ball => ball.id)).toEqual(scenario.balls.map(ball => ball.id));
      expect(endpoints.find(ball => ball.id === 0)!.pocketed).toBe(replay.scratch);
      expect(endpoints.find(ball => ball.id === plan.ballId)!.position).toEqual(result.sampleObjectPaths[index].path.at(-1));
      if (!replay.scratch && replay.stopped) statisticalEnds.push(replay.cueEnd);
    }
    expect(result.sampleEnds).toEqual(statisticalEnds);
    expect(result.sampleBallEnds.filter(balls => balls.find(ball => ball.id === 0)!.pocketed)).toHaveLength(result.scratchRate * 64);
  });
});
