import { expect, it } from 'vitest';
import { generateScenario } from './scenarios';
import { prepareRound } from './preparation';
import { simulateShot } from './physics';
import { zoneExitEvidence, zoneExitPairFinder } from './zone-exit';
import { directShotRoutes, evaluateShotObjective } from './objectives';
import { secondShotPotted } from './second-shot';
import { distance } from './math';
import { analyzeRound } from './analysis';
import { PREMADE_CHARACTERS } from './characters';

it.each([0, 1, 5, 8, 35 * 919])('isolates a spare-ball blockage inside the shared zone, seed %i', seed => {
  const source = generateScenario(35, seed), original = structuredClone(source);
  const p = prepareRound(source, { regenerate: false }), c = p.zoneExit!;
  expect(source).toEqual(original);
  expect(p.scenario.balls).toEqual(source.balls);
  expect(c).toBeDefined(); expect(c.blockerId).toBe(3);
  const entries = p.balls[0].options.filter(o => [c.blockedId, c.clearId].includes(o.id)).map(o => ({ plan: o.plan, simulation: simulateShot(p.scenario, o.plan) }));
  const before = structuredClone(entries), pair = zoneExitPairFinder(p.scenario)(entries)!;
  expect(pair).not.toBeNull();
  expect(pair.blocked.plan.id).toBe(c.blockedId); expect(pair.clear.plan.id).toBe(c.clearId);
  expect(pair.pocketId).toBe(c.pocketId);
  expect(pair.blocked.plan.pocketId).toBe(pair.clear.plan.pocketId);
  for (const entry of entries) {
    const objective = evaluateShotObjective(p.scenario, entry.plan, entry.simulation);
    expect(objective.legalPot).toBe(true); expect(objective.positioned).toBe(true);
    for (const ball of source.balls.filter(b => b.id > 1)) expect(distance(ball.position, entry.simulation.finalBalls.find(b => b.id === ball.id)!.position)).toBeLessThan(.001);
  }
  const blocked = zoneExitEvidence(p.scenario, pair.blocked.simulation, c.blockerId, c.pocketId);
  const clear = zoneExitEvidence(p.scenario, pair.clear.simulation, c.blockerId, c.pocketId);
  expect(blocked.routes).toHaveLength(0); expect(blocked.approachBlocked).toBe(true); expect(blocked.potLineClear).toBe(true);
  expect(blocked.restored).toBeDefined(); expect(blocked.route).toBeUndefined();
  expect(clear.route).toBeDefined(); expect(clear.approachBlocked).toBe(false); expect(clear.potLineClear).toBe(true);
  const restoredBalls = pair.blocked.simulation.finalBalls.filter(b => !b.pocketed && b.id !== c.blockerId);
  expect(directShotRoutes(restoredBalls, 2, source.objective!.maxCutAngle).some(r => r.pocketId === c.pocketId)).toBe(true);
  expect(restoredBalls.map(b => b.id)).toEqual([0, 2]);
  expect(pair.nextScenario.balls).toEqual(pair.clear.simulation.finalBalls.filter(b => !b.pocketed).map(({ id, position }) => ({ id, position })));
  expect(pair.plan.pocketId).toBe(c.pocketId); expect(secondShotPotted(2, pair.simulation)).toBe(true);
  expect(entries).toEqual(before);
  for (const character of PREMADE_CHARACTERS) {
    const result = analyzeRound(p, { ballId: 1, optionId: c.blockedId }, { samples: 32, talents: character.talents });
    expect(result.candidates.some(shot => shot.successRate > 0)).toBe(true);
    const selected = zoneExitEvidence(p.scenario, result.selected.nominal, c.blockerId, c.pocketId);
    expect(selected.approachBlocked).toBe(true); expect(selected.routes).toHaveLength(0);
  }
}, 30000);

it('rejects invalid openers and cannot fabricate restoration without a blocker', () => {
  const p = prepareRound(generateScenario(35, 0), { regenerate: false }), c = p.zoneExit!;
  const entries = p.balls[0].options.map(o => ({ plan: o.plan, simulation: simulateShot(p.scenario, o.plan) }));
  for (const flags of [{ scratch: true }, { stopped: false }, { firstContact: 2 }, { potted: [] }]) {
    expect(zoneExitPairFinder(p.scenario)(entries.map(e => ({ ...e, simulation: { ...e.simulation, ...flags } })))).toBeNull();
  }
  const sim = entries.find(e => e.plan.id === c.blockedId)!.simulation;
  const noBlocker = zoneExitEvidence(p.scenario, { ...sim, finalBalls: sim.finalBalls.filter(b => b.id !== c.blockerId) }, c.blockerId, c.pocketId);
  expect(noBlocker.approachBlocked).toBe(false); expect(noBlocker.route).toBeDefined();
});
