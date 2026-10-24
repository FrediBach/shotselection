import { expect, it } from 'vitest';
import { generateScenario } from './scenarios';
import { prepareRound } from './preparation';
import { simulateShot } from './physics';
import { secondShotSetup, secondShotPlan, secondShotPotted } from './second-shot';

it.each([0, 1, 5, 8, 32 * 919])('plays a second pot from the exact remaining layout, seed %i', seed => {
  const prepared = prepareRound(generateScenario(32, seed), { regenerate: false });
  let proven = false;
  for (const option of prepared.balls.flatMap(ball => ball.options)) {
    const first = simulateShot(prepared.scenario, option.plan);
    const before = structuredClone({ scenario: prepared.scenario, first });
    const setup = secondShotSetup(prepared.scenario, option.plan, first);
    expect(setup.scenario.balls).toEqual(first.finalBalls.filter(ball => !ball.pocketed).map(({ id, position }) => ({ id, position })));
    expect(setup.scenario.objective).toBeUndefined();
    expect(setup.scenario.curriculum).toBeUndefined();
    expect(setup.scenario.conditions).toEqual(prepared.scenario.conditions);
    for (const route of setup.routes) for (const pace of [.95, 1.2, 1.5]) for (const spin of [0, -.7, 1]) {
      const plan = secondShotPlan(setup.scenario, setup.ballId, route, pace, spin);
      const second = simulateShot(setup.scenario, plan);
      expect(second.frames.length).toBeGreaterThan(1);
      expect(second.frames[0].balls.map(({ id, position }) => ({ id, position }))).toEqual(setup.scenario.balls);
      if (secondShotPotted(setup.ballId, second)) proven = true;
    }
    expect({ scenario: prepared.scenario, first }).toEqual(before);
  }
  expect(proven).toBe(true);
}, 30000);

it('ends failed sequences without respotting or substituting another opener', () => {
  const p = prepareRound(generateScenario(32, 0), { regenerate: false });
  const plan = p.balls[0].options[0].plan;
  const first = simulateShot(p.scenario, plan);
  expect(secondShotSetup(p.scenario, plan, { ...first, stopped: false }).reason).toContain('did not settle');
  expect(secondShotSetup(p.scenario, plan, { ...first, stopped: true, scratch: true }).reason).toContain('scratched');
  expect(secondShotSetup(p.scenario, plan, { ...first, stopped: true, scratch: false, firstContact: 3 }).reason).toContain('did not legally pot');
  const legal = { ...first, stopped: true, scratch: false, firstContact: 1, potted: [1] };
  expect(secondShotSetup(p.scenario, plan, { ...legal, finalBalls: legal.finalBalls.map(ball => ball.id === 2 ? { ...ball, pocketed: true } : ball) }).reason).toContain('already potted');
  const blocked = secondShotSetup({ ...p.scenario, objective: { ...p.scenario.objective!, maxCutAngle: 0 } }, plan, legal);
  expect(blocked.routes).toHaveLength(0);
  expect(blocked.reason).toContain('No clear direct route');
  expect(secondShotPotted(2, { ...legal, firstContact: 2, potted: [2], scratch: true })).toBe(false);
  expect(secondShotPotted(2, { ...legal, firstContact: 1, potted: [2] })).toBe(false);
});
