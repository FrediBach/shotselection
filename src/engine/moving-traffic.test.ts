import { expect, it } from 'vitest';
import { generateScenario } from './scenarios';
import { prepareRound } from './preparation';
import { simulateShot } from './physics';
import { movingTrafficEvidence, movingTrafficPairFinder } from './moving-traffic';
import { directShotRoutes, evaluateShotObjective } from './objectives';
import { secondShotPotted } from './second-shot';
import { distance } from './math';
import { analyzeRound } from './analysis';
import { PREMADE_CHARACTERS } from './characters';

it.each([0, 1, 5, 8, 42 * 919])('isolates displaced traffic from the settled cue geometry, seed %i', seed => {
  const source = generateScenario(42, seed), original = structuredClone(source);
  const p = prepareRound(source, { regenerate: false }), c = p.movingTraffic!;
  expect(source).toEqual(original); expect(p.scenario.balls).toEqual(source.balls); expect(c).toBeDefined();
  const entries = p.balls[0].options.filter(o => [c.blockedId, c.clearId].includes(o.id)).map(o => ({ plan: o.plan, simulation: simulateShot(p.scenario, o.plan) }));
  const before = structuredClone(entries), pair = movingTrafficPairFinder(p.scenario)(entries)!;
  expect(pair).not.toBeNull();
  expect(pair.blocked.plan.id).toBe(c.blockedId); expect(pair.clear.plan.id).toBe(c.clearId); expect(pair.pocketId).toBe(c.pocketId);
  expect(pair.blocked.plan.pocketId).toBe(pair.clear.plan.pocketId);
  expect(pair.moved.contacted).toBe(true); expect(pair.moved.moved).toBeGreaterThanOrEqual(.08);
  expect(pair.kept.contacted).toBe(false); expect(pair.kept.moved).toBeLessThan(.001);
  expect(pair.moved.routes).toHaveLength(0); expect(pair.kept.routes.length).toBeGreaterThan(0);
  expect(pair.approachBlocked).toBe(false); expect(pair.pocketBlocked).toBe(true);
  expect(pair.moved.resetRoutes.some(r => r.pocketId === c.pocketId)).toBe(true);
  expect(pair.moved.removedRoutes.some(r => r.pocketId === c.pocketId)).toBe(true);
  for (const entry of entries) {
    const outcome = evaluateShotObjective(p.scenario, entry.plan, entry.simulation);
    expect(outcome.legalPot).toBe(true); expect(outcome.positioned).toBe(true);
    for (const ball of source.balls.filter(b => b.id === 2 || b.id === 4)) expect(distance(ball.position, entry.simulation.finalBalls.find(b => b.id === ball.id)!.position)).toBeLessThan(.001);
  }
  for (const ball of pair.moved.resetBalls) expect(ball.position).toEqual(ball.id === 3 ? source.balls.find(b => b.id === 3)!.position : pair.moved.balls.find(b => b.id === ball.id)!.position);
  expect(pair.moved.resetRoutes).toEqual(directShotRoutes(pair.moved.resetBalls, 2, source.objective!.maxCutAngle));
  expect(pair.nextScenario.balls).toEqual(pair.clear.simulation.finalBalls.filter(b => !b.pocketed).map(({ id, position }) => ({ id, position })));
  expect(pair.plan.pocketId).toBe(c.pocketId); expect(secondShotPotted(2, pair.simulation)).toBe(true);
  expect(pair.simulation).toEqual(simulateShot(pair.nextScenario, pair.plan, { record: false, recordPaths: true }));
  expect(entries).toEqual(before);
  for (const character of PREMADE_CHARACTERS) {
    const result = analyzeRound(p, { ballId: 1, optionId: c.blockedId }, { samples: 32, talents: character.talents });
    expect(result.candidates.some(shot => shot.successRate > 0)).toBe(true);
    expect(movingTrafficPairFinder(p.scenario)(result.candidates.map(s => ({ plan: s.plan, simulation: s.nominal })))).not.toBeNull();
  }
}, 30000);

it('rejects invalid openers, missing blockers, moved targets and fabricated non-contact movement', () => {
  const p = prepareRound(generateScenario(42, 0), { regenerate: false });
  const entries = p.balls[0].options.map(o => ({ plan: o.plan, simulation: simulateShot(p.scenario, o.plan) }));
  const opening = entries.find(e => e.plan.id === p.movingTraffic!.blockedId)!.simulation;
  for (const flags of [{ scratch: true }, { stopped: false }, { firstContact: 2 }, { potted: [] }]) expect(movingTrafficEvidence(p.scenario, { ...opening, ...flags })).toBeNull();
  expect(movingTrafficEvidence(p.scenario, { ...opening, finalBalls: opening.finalBalls.filter(b => b.id !== 3) })).toBeNull();
  expect(movingTrafficEvidence(p.scenario, { ...opening, finalBalls: opening.finalBalls.map(b => b.id === 2 ? { ...b, position: { x: .4, y: .4 } } : b) })).toBeNull();
  expect(movingTrafficPairFinder(p.scenario)(entries.map(e => ({ ...e, simulation: { ...e.simulation, ballContacts: [[0, 1]] } })))).toBeNull();
  expect(movingTrafficPairFinder({ ...p.scenario, objective: undefined })(entries)).toBeNull();
});
