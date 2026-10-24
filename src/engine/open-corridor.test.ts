import { expect, it } from 'vitest';
import { generateScenario } from './scenarios';
import { prepareRound } from './preparation';
import { openCorridorEvidence, openCorridorPair } from './open-corridor';
import { simulateShot } from './physics';
import { directShotRoutes } from './objectives';
import { secondShotPotted } from './second-shot';
import { TABLE } from './constants';
import { POCKET_GEOMETRY } from './table-geometry';
import { distance, segmentDistance } from './math';
import { analyzeRound } from './analysis';
import { PREMADE_CHARACTERS } from './characters';

it.each([0, 1, 5, 8, 45 * 919])('opens the same next corridor by potting its blocker, seed %i', seed => {
  const source = generateScenario(45, seed), before = structuredClone(source);
  const p = prepareRound(source, { regenerate: false }), c = p.openCorridor!;
  expect(source).toEqual(before); expect(p.scenario.balls).toEqual(source.balls);
  expect(p.scenario.objective).toBeUndefined(); expect(p.balls.map(b => b.ballId)).toEqual([1, 3]);
  const entries = p.balls.flatMap(b => b.options).filter(o => [c.openedId, c.blockedId].includes(o.id)).map(o => ({ plan: o.plan, simulation: simulateShot(p.scenario, o.plan) }));
  const untouched = structuredClone(entries), pair = openCorridorPair(p.scenario, entries)!;
  expect(pair).not.toBeNull(); expect(pair.pocketId).toBe(c.pocketId);
  expect(pair.opened.opening.plan.id).toBe(c.openedId); expect(pair.blocked.opening.plan.id).toBe(c.blockedId);
  const blocker = source.balls.find(b => b.id === 1)!, object = source.balls.find(b => b.id === 2)!, pocket = POCKET_GEOMETRY.find(b => b.id === c.pocketId)!;
  expect(segmentDistance(blocker.position, object.position, pocket.center)).toBeLessThan(TABLE.ballDiameter - .005);
  for (const e of [pair.opened, pair.blocked]) {
    expect(secondShotPotted(e.opening.plan.ballId, e.opening.simulation)).toBe(true);
    expect(e.opening.simulation.potted).toEqual([e.opening.plan.ballId]);
    for (const b of source.balls.filter(b => b.id !== 0 && b.id !== e.opening.plan.ballId)) expect(distance(b.position, e.scenario.balls.find(c => c.id === b.id)!.position)).toBeLessThan(.001);
    expect(e.route.cutAngle).toBeLessThanOrEqual(50);
    expect(segmentDistance(blocker.position, e.opening.simulation.cueEnd, e.route.ghost)).toBeGreaterThanOrEqual(TABLE.ballDiameter * 1.025);
    expect(directShotRoutes(e.withBlocker.balls, 2, 50).some(r => r.pocketId === c.pocketId)).toBe(false);
    expect(directShotRoutes(e.without.balls, 2, 50).some(r => r.pocketId === c.pocketId)).toBe(true);
    expect(secondShotPotted(2, e.proof.simulation)).toBe(true);
    expect(e.proof.plan.pocketId).toBe(c.pocketId);
    expect(simulateShot(e.proof.scenario, e.proof.plan, { record: false, recordPaths: true })).toEqual(e.proof.simulation);
  }
  expect(pair.opened.proof.scenario.balls).toEqual(pair.opened.scenario.balls);
  expect(pair.opened.withBlocker.balls).toEqual([...pair.opened.scenario.balls, blocker]);
  expect(pair.blocked.without.balls).toEqual(pair.blocked.scenario.balls.filter(b => b.id !== 1));
  expect(entries).toEqual(untouched);
  for (const character of PREMADE_CHARACTERS) {
    const result = analyzeRound(p, { ballId: 1, optionId: c.openedId }, { samples: 32, talents: character.talents });
    expect(result.candidates.some(s => s.successRate > 0)).toBe(true);
    expect(openCorridorPair(p.scenario, result.candidates.map(s => ({ plan: s.plan, simulation: s.nominal })))).not.toBeNull();
  }
}, 30000);

it('rejects invalid pots and displaced or missing remaining objects', () => {
  const p = prepareRound(generateScenario(45, 0), { regenerate: false });
  const entries = p.balls.flatMap(b => b.options).map(o => ({ plan: o.plan, simulation: simulateShot(p.scenario, o.plan) }));
  for (const e of entries) {
    for (const flags of [{ scratch: true }, { stopped: false }, { firstContact: 2 }, { potted: [] }, { potted: [1, 3] }]) expect(openCorridorEvidence(p.scenario, { ...e, simulation: { ...e.simulation, ...flags } })).toBeNull();
    for (const id of p.scenario.balls.filter(b => b.id !== 0 && b.id !== e.plan.ballId).map(b => b.id)) {
      expect(openCorridorEvidence(p.scenario, { ...e, simulation: { ...e.simulation, finalBalls: e.simulation.finalBalls.map(b => b.id === id ? { ...b, position: { x: .1, y: .1 } } : b) } })).toBeNull();
      expect(openCorridorEvidence(p.scenario, { ...e, simulation: { ...e.simulation, finalBalls: e.simulation.finalBalls.filter(b => b.id !== id) } })).toBeNull();
    }
  }
  expect(openCorridorPair(p.scenario, entries.filter(e => e.plan.ballId === 1))).toBeNull();
});
