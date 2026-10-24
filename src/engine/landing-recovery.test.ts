import { expect, it } from 'vitest';
import { generateScenario } from './scenarios';
import { prepareRound } from './preparation';
import { simulateShot } from './physics';
import { evaluateShotObjective } from './objectives';
import { directReplyPotted } from './defensive-outcome';
import { landingRecoveryPreview } from './landing-recovery';
import { distance } from './math';

it.each([0, 1, 5, 8, 80 * 919])('adapts from two real successful off-center landings, seed %i', seed => {
  const source = generateScenario(80, seed), before = structuredClone(source);
  const p = prepareRound(source, { regenerate: false }), data = p.landingRecovery!;
  expect(data).toBeDefined(); expect(source).toEqual(before); expect(p.scenario.balls).toEqual(source.balls);
  expect(p.scenario.objective).toMatchObject({ radius: .12, maxCutAngle: 40 });
  const reference = p.balls[0].options.find(o => o.id === data.referenceId)!;
  expect(data.leaves.map(l => l.multiplier)).toEqual([.98, 1.03]);
  for (const [i, leaf] of data.leaves.entries()) {
    expect(leaf.opener).toEqual({ ...reference.plan, speed: reference.plan.speed * leaf.multiplier });
    expect(evaluateShotObjective(p.scenario, leaf.opener, leaf.first).success).toBe(true);
    expect(distance(leaf.first.cueEnd, p.scenario.objective!.target!)).toBeGreaterThan(.01);
    expect(leaf.first).toEqual(simulateShot(p.scenario, leaf.opener, { record: false, recordPaths: true }));
    expect(leaf.scenario.balls).toEqual(leaf.first.finalBalls.filter(b => !b.pocketed).map(b => ({ id: b.id, position: b.position })));
    expect(directReplyPotted(leaf.response, leaf.second)).toBe(true);
    expect(leaf.second).toEqual(simulateShot(leaf.scenario, leaf.response, { record: false, recordPaths: true }));
    const other = data.leaves[1-i].response;
    expect(data.copied[i]).toEqual(simulateShot(leaf.scenario, other, { record: false, recordPaths: true }));
    expect(directReplyPotted(other, data.copied[i])).toBe(false);
  }
  expect(Math.abs(data.leaves[0].cut-data.leaves[1].cut)).toBeGreaterThan(5);
  expect(distance(data.leaves[0].first.cueEnd,data.leaves[1].first.cueEnd)).toBeGreaterThan(.04);
  expect(landingRecoveryPreview({ ...p.scenario, objective: undefined }, p.balls[0].options)).toBeNull();
  expect(landingRecoveryPreview(p.scenario, [])).toBeNull();
});
