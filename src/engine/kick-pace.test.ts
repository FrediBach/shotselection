import { expect, it } from 'vitest';
import { prepareRound } from './preparation';
import { generateScenario } from './scenarios';
import { simulateShot } from './physics';
import { kickPaceEvidence, reboundSpeed, slowerKickPlan } from './kick-pace';
import { cueStroke } from './table-conditions';
import { TABLE } from './constants';
import { distance } from './math';
import { analyzeRound } from './analysis';
import { PREMADE_CHARACTERS } from './characters';

it.each([0, 1, 5, 8, 53 * 919])('shows a controlled kick that rebounds and stops short, seed %i', seed => {
  const source = generateScenario(53, seed), original = structuredClone(source);
  const p = prepareRound(source, { regenerate: false }), x = p.kickPace!;
  expect(source).toEqual(original); expect(p.scenario.balls).toEqual(source.balls);
  expect(x).toBeDefined(); expect(p.balls[0].options).toHaveLength(3);
  const option = p.balls[0].options.find(o => o.id === x.referenceId)!;
  const before = structuredClone(x), evidence = kickPaceEvidence(source, option.plan, x.reference, x.weakPlan, x.weak)!;
  expect(evidence).not.toBeNull(); expect(x).toEqual(before);
  const a = cueStroke(option.plan), b = cueStroke(x.weakPlan);
  expect(b.speed).toBeLessThan(a.speed); expect(b.angle).toBe(a.angle); expect(b.sideSpin).toBe(a.sideSpin);
  expect(b.speed * b.topSpin / TABLE.ballRadius).toBeCloseTo(a.speed * a.topSpin / TABLE.ballRadius, 10);
  expect({ ...x.weakPlan, speed: option.plan.speed, topSpin: option.plan.topSpin }).toEqual(option.plan);
  expect(x.weakPlan).toEqual(slowerKickPlan(source, option.plan, x.multiplier));
  expect(x.weak).toEqual(simulateShot(source, x.weakPlan, { record: false, recordPaths: true }));
  expect(x.reference).toEqual(simulateShot(source, option.plan, { record: false, recordPaths: true }));
  expect(x.reference.potted).toContain(1); expect(x.reference.scratch).toBe(false);
  expect(x.weak.potted).toEqual([]); expect(x.weak.firstContact).toBeNull(); expect(x.weak.stopped).toBe(true);
  expect(x.weak.cueRebounds).toHaveLength(1); expect(evidence.shortfall).toBeGreaterThanOrEqual(.15);
  expect(distance(evidence.good.position, evidence.weak.position)).toBeLessThanOrEqual(.03);
  for (const r of [evidence.good, evidence.weak]) expect(reboundSpeed(r.incoming) - reboundSpeed(r.outgoing)).toBeGreaterThanOrEqual(.01);
  expect(evidence.incoming.at(-1)).toEqual(evidence.weak.position);
  expect(evidence.outgoing[0]).toEqual(evidence.weak.position);
  for (const ball of source.balls.filter(b => b.id !== 0)) expect(x.weak.finalBalls.find(b => b.id === ball.id)!.position).toEqual(ball.position);
  for (const character of PREMADE_CHARACTERS) {
    const result = analyzeRound(p, { ballId: 1, optionId: option.id }, { samples: 32, talents: character.talents });
    expect(kickPaceEvidence(source, option.plan, result.selected.nominal, x.weakPlan, x.weak)).not.toBeNull();
  }
});

it('rejects changed controls, spin, collisions and weak routes that do not stop short after a rebound', () => {
  const p = prepareRound(generateScenario(53, 0), { regenerate: false }), x = p.kickPace!;
  const plan = p.balls[0].options.find(o => o.id === x.referenceId)!.plan;
  for (const invalid of [
    { ...x.weak, stopped: false }, { ...x.weak, scratch: true }, { ...x.weak, firstContact: 1 },
    { ...x.weak, potted: [1] }, { ...x.weak, cueRebounds: [] },
    { ...x.weak, cueEnd: p.scenario.balls.find(b => b.id === 1)!.position },
    { ...x.weak, cueBanksBeforeContact: 0 },
    { ...x.weak, finalBalls: x.weak.finalBalls.filter(b => b.id !== 2) },
  ]) expect(kickPaceEvidence(p.scenario, plan, x.reference, x.weakPlan, invalid)).toBeNull();
  for (const invalid of [
    { ...x.weakPlan, angle: x.weakPlan.angle + .01 }, { ...x.weakPlan, sideSpin: 1 },
    { ...x.weakPlan, topSpin: x.weakPlan.topSpin + .1 }, { ...x.weakPlan, speed: plan.speed },
  ]) expect(kickPaceEvidence(p.scenario, plan, x.reference, invalid, x.weak)).toBeNull();
});
