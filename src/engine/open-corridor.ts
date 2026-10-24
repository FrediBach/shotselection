import { TABLE } from './constants';
import { distance, segmentDistance } from './math';
import { directShotRoutes } from './objectives';
import { POCKET_GEOMETRY } from './table-geometry';
import { secondShotPlan, secondShotPotted } from './second-shot';
import { simulateShot } from './physics';
import type { Opening } from './look-ahead';
import type { Scenario } from './types';

/** Compare legal pots of 1 (the blocker) and 3, preserving every other object. */
export function openCorridorEvidence(source: Scenario, opening: Opening) {
  const id = opening.plan.ballId, sim = opening.simulation;
  if (![1, 3].includes(id) || !secondShotPotted(id, sim) || sim.potted.length !== 1) return null;
  const blocker = source.balls.find(b => b.id === 1), object = source.balls.find(b => b.id === 2);
  if (!blocker || !object) return null;
  const balls = sim.finalBalls.filter(b => !b.pocketed).map(({ id, position }) => ({ id, position: { ...position } }));
  if (source.balls.filter(b => b.id !== 0 && b.id !== id).some(b => {
    const end = balls.find(c => c.id === b.id);
    return !end || distance(end.position, b.position) > .001;
  })) return null;
  const scenario: Scenario = { level: source.level, seed: source.seed, title: 'After the opening pot', description: '', conditions: source.conditions, balls };
  // Change exactly one ball at the same settled cue position: no respotting the cue.
  const without = id === 1 ? scenario : { ...scenario, balls: balls.filter(b => b.id !== 1) };
  const withBlocker = id === 1 ? { ...scenario, balls: [...balls, structuredClone(blocker)] } : scenario;
  for (const route of directShotRoutes(without.balls, 2, 50)) {
    const pocket = POCKET_GEOMETRY.find(p => p.id === route.pocketId)!;
    if (segmentDistance(blocker.position, object.position, pocket.center) >= TABLE.ballDiameter - .005
      || segmentDistance(blocker.position, sim.cueEnd, route.ghost) < TABLE.ballDiameter * 1.025
      || directShotRoutes(withBlocker.balls, 2, 50).some(r => r.pocketId === route.pocketId)) continue;
    for (const pace of [.95, 1.2, 1.5]) for (const spin of [0, -.7, 1]) {
      const plan = secondShotPlan(without, 2, route, pace, spin);
      const simulation = simulateShot(without, plan, { record: false, recordPaths: true });
      if (secondShotPotted(2, simulation)) return { opening, scenario, without, withBlocker, route, proof: { scenario: without, plan, simulation } };
    }
  }
  return null;
}

export function openCorridorPair(source: Scenario, entries: Opening[]) {
  const inspected = entries.map(e => openCorridorEvidence(source, e)).filter(e => e !== null);
  for (const opened of inspected.filter(e => e.opening.plan.ballId === 1)) {
    const blocked = inspected.find(e => e.opening.plan.ballId === 3 && e.route.pocketId === opened.route.pocketId);
    if (blocked) return { opened, blocked, pocketId: opened.route.pocketId };
  }
  return null;
}
