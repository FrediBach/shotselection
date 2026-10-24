import { TABLE } from './constants';
import { distance, dot, normalize, segmentDistance, subtract } from './math';
import { directNextShotRoutes } from './objectives';
import { secondShotPlan, secondShotPotted, secondShotSetup } from './second-shot';
import { simulateShot } from './physics';
import type { Opening } from './look-ahead';
import type { Scenario } from './types';

/** Clearance is measured on the next cue approach, with both gate balls retained. */
export function corridorCenterEvidence(source: Scenario, opening: Opening) {
  if (!source.objective || !secondShotPotted(1, opening.simulation) || opening.simulation.potted.length !== 1
    || opening.simulation.ballContacts?.length !== 1) return [];
  if (source.balls.filter(b => b.id > 1).some(b => {
    const end = opening.simulation.finalBalls.find(c => c.id === b.id && !c.pocketed);
    return !end || distance(end.position, b.position) > .001;
  })) return [];
  const blockers = [3, 4].map(id => source.balls.find(b => b.id === id));
  if (!blockers[0] || !blockers[1]) return [];
  const cue = opening.simulation.cueEnd;
  return directNextShotRoutes(source, opening.simulation).flatMap(route => {
    const direction = normalize(subtract(route.ghost, cue)), length = distance(cue, route.ghost);
    const sides = blockers.map(b => {
      const v = subtract(b!.position, cue);
      return { id: b!.id, position: b!.position, along: dot(v, direction), side: direction.x * v.y - direction.y * v.x,
        clearance: segmentDistance(b!.position, cue, route.ghost) - TABLE.ballDiameter };
    });
    if (sides[0].side * sides[1].side >= 0 || sides.some(b => b.along < .1 || b.along > length - .1)
      || Math.abs(sides[0].along - sides[1].along) > .06) return [];
    return [{ opening, route, sides, clearance: Math.min(...sides.map(b => b.clearance)) }];
  });
}

export function corridorCenterPairFinder(source: Scenario) {
  const cache = new Map<Opening, ReturnType<typeof corridorCenterEvidence>>();
  const evidence = (e: Opening) => { if (!cache.has(e)) cache.set(e, corridorCenterEvidence(source, e)); return cache.get(e)!; };
  type Evidence = ReturnType<typeof corridorCenterEvidence>[number];
  const proofs = new Map<Evidence, ReturnType<typeof prove>>();
  function prove(e: Evidence) {
    const { scenario } = secondShotSetup(source, e.opening.plan, e.opening.simulation);
    for (const pace of [.95, 1.2, 1.5]) for (const spin of [0, -.7, 1]) {
      const plan = secondShotPlan(scenario, 2, e.route, pace, spin);
      const simulation = simulateShot(scenario, plan, { record: false, recordPaths: true });
      if (secondShotPotted(2, simulation) && simulation.potted.length === 1 && simulation.ballContacts?.length === 1) return { scenario, plan, simulation };
    }
    return null;
  }
  const proof = (e: Evidence) => { if (!proofs.has(e)) proofs.set(e, prove(e)); return proofs.get(e)!; };
  return (entries: Opening[]) => {
    if (!source.objective) return null;
    for (const center of entries) for (const central of evidence(center)) {
      if (central.clearance < .025 || Math.abs(central.sides[0].clearance - central.sides[1].clearance) > .01) continue;
      for (const edge of entries) {
        if (edge === center || edge.plan.pocketId !== center.plan.pocketId) continue;
        const target = source.objective.target ?? { x: (center.simulation.cueEnd.x + edge.simulation.cueEnd.x) / 2, y: (center.simulation.cueEnd.y + edge.simulation.cueEnd.y) / 2 };
        if ([center, edge].some(e => distance(e.simulation.cueEnd, target) > source.objective!.radius * .95)) continue;
        for (const marginal of evidence(edge)) {
          if (marginal.route.pocketId !== central.route.pocketId || marginal.clearance < .003 || marginal.clearance > .012
            || Math.abs(marginal.route.cutAngle - central.route.cutAngle) > 8 || central.clearance - marginal.clearance < .025) continue;
          const centerProof = proof(central), edgeProof = proof(marginal);
          if (centerProof && edgeProof) return { center, edge, central, marginal, target, centerProof, edgeProof };
        }
      }
    }
    return null;
  };
}
