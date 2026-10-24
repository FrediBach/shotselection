import { TABLE } from './constants';
import { distance, normalize, segmentDistance, subtract } from './math';
import { nearestPoint } from './ball-width';
import { simulateShot } from './physics';
import { secondShotPotted } from './second-shot';
import { hasProvenNextShot } from './objectives';
import type { Opening } from './look-ahead';
import type { Scenario, Vec2 } from './types';

export function pathClearance(point: Vec2, path: Vec2[]) {
  return Math.min(...path.slice(1).map((end, i) => segmentDistance(point, path[i], end))) - TABLE.ballDiameter;
}

export function returnLaneEvidence(source: Scenario, opening: Opening) {
  if (!source.objective || !secondShotPotted(1, opening.simulation) || opening.simulation.potted.length !== 1
    || opening.simulation.ballContacts?.length !== 1 || opening.simulation.cueRebounds?.length !== 1
    || opening.simulation.cueRebounds[0].beforeContact) return null;
  if (source.balls.filter(b => b.id > 1).some(b => {
    const end = opening.simulation.finalBalls.find(c => c.id === b.id && !c.pocketed);
    return !end || distance(end.position, b.position) > .001;
  })) return null;
  const blocker = source.balls.find(b => b.id === 3);
  if (!blocker) return null;
  const traced = simulateShot(source, opening.plan, { record: false, recordPaths: true });
  const rebound = traced.cueRebounds![0];
  const index = traced.cuePath.findIndex(p => distance(p, rebound.position) < 1e-9);
  if (index < 1 || index >= traced.cuePath.length - 1) return null;
  const outbound = traced.cuePath.slice(0, index + 1), returning = traced.cuePath.slice(index);
  const outboundClearance = pathClearance(blocker.position, outbound), clearance = pathClearance(blocker.position, returning);
  if (outboundClearance < .03 || source.balls.filter(b => b.id > 1 && b.id !== 3).some(b => pathClearance(b.position, traced.cuePath) < .03)) return null;
  const nearest = returning.slice(1).map((end, i) => nearestPoint(blocker.position, returning[i], end)).sort((a, b) => distance(a, blocker.position) - distance(b, blocker.position))[0];
  return { opening, traced, rebound, outbound, returning, blocker, outboundClearance, clearance, nearest };
}

/** Two clean nominal rebounds: a narrow return pass versus a generous one. */
export function returnLanePairFinder(source: Scenario) {
  const cache = new Map<Opening, ReturnType<typeof returnLaneEvidence>>();
  const evidence = (e: Opening) => { if (!cache.has(e)) cache.set(e, returnLaneEvidence(source, e)); return cache.get(e)!; };
  const proofs = new Map<Opening, boolean>();
  const provesNext = (e: Opening) => { if (!proofs.has(e)) proofs.set(e, hasProvenNextShot(source, e.simulation)); return proofs.get(e)!; };
  const probes = new Map<Opening, ReturnType<typeof probe>>();
  function probe(narrow: NonNullable<ReturnType<typeof returnLaneEvidence>>) {
    const direction = normalize(subtract(narrow.nearest, narrow.blocker.position)), shift = narrow.clearance + .004;
    const position = { x: narrow.blocker.position.x + direction.x * shift, y: narrow.blocker.position.y + direction.y * shift };
    if (position.x < TABLE.ballRadius || position.x > TABLE.length - TABLE.ballRadius
      || position.y < TABLE.ballRadius || position.y > TABLE.width - TABLE.ballRadius
      || source.balls.some(b => b.id !== 3 && distance(b.position, position) < TABLE.ballDiameter + .001)) return null;
    const scenario: Scenario = { ...source, balls: source.balls.map(b => b.id === 3 ? { ...b, position } : b) };
    const simulation = simulateShot(scenario, narrow.opening.plan, { record: false, recordPaths: true, recordContacts: true });
    const contact = simulation.cueContacts?.find(c => c.ballId === 3 && c.time > narrow.rebound.time);
    if (!contact || !secondShotPotted(1, simulation) || simulation.ballContacts?.length !== 2
      || simulation.ballContacts[1][0] !== 0 || simulation.ballContacts[1][1] !== 3
      || !simulation.cueRebounds?.length || simulation.cueRebounds[0].time !== narrow.rebound.time
      || distance(simulation.cueRebounds[0].position, narrow.rebound.position) > 1e-9) return null;
    return { scenario, simulation, shift, contact };
  }
  return (entries: Opening[]) => {
    if (!source.objective) return null;
    for (const risky of entries) {
      const narrow = evidence(risky);
      if (!narrow || narrow.clearance < .002 || narrow.clearance > .01
        || distance(narrow.nearest, narrow.rebound.position) < .08 || distance(narrow.nearest, risky.simulation.cueEnd) < .08) continue;
      for (const clear of entries) {
        const wide = evidence(clear);
        if (!wide || wide.clearance < .04 || risky.plan.pocketId !== clear.plan.pocketId) continue;
        const target = source.objective.target ?? { x: (risky.simulation.cueEnd.x + clear.simulation.cueEnd.x) / 2, y: (risky.simulation.cueEnd.y + clear.simulation.cueEnd.y) / 2 };
        if ([risky, clear].some(e => distance(e.simulation.cueEnd, target) > source.objective!.radius * .95)
          || !provesNext(risky) || !provesNext(clear)) continue;
        if (!probes.has(risky)) probes.set(risky, probe(narrow));
        const shifted = probes.get(risky);
        if (shifted) return { risky, clear, narrow, wide, target, shifted };
      }
    }
    return null;
  };
}
