import { directNextShotRoutes, directShotRoutes } from './objectives';
import { secondShotPlan, secondShotPotted } from './second-shot';
import { simulateShot } from './physics';
import { TABLE } from './constants';
import { POCKET_GEOMETRY } from './table-geometry';
import { distance, segmentDistance } from './math';
import type { Opening } from './look-ahead';
import type { Scenario, Simulation } from './types';

/** Hold the settled cue and every other ball fixed; reset only the displaced spare. */
export function movingTrafficEvidence(source: Scenario, simulation: Simulation, blockerId = 3) {
  if (!source.objective || !secondShotPotted(1, simulation)) return null;
  const start = source.balls.find(b => b.id === blockerId);
  const balls = simulation.finalBalls.filter(b => !b.pocketed);
  const blocker = balls.find(b => b.id === blockerId);
  if (!start || !blocker || source.balls.filter(b => b.id > 1 && b.id !== blockerId).some(b => {
    const end = balls.find(c => c.id === b.id);
    return !end || distance(end.position, b.position) > .001;
  })) return null;
  const resetBalls = balls.map(b => ({ id: b.id, position: { ...(b.id === blockerId ? start.position : b.position) } }));
  return { balls, blocker, start, resetBalls, moved: distance(start.position, blocker.position),
    contacted: Boolean(simulation.ballContacts?.some(([a, b]) => (a === 0 && b === blockerId) || (b === 0 && a === blockerId))),
    routes: directNextShotRoutes(source, simulation),
    resetRoutes: directShotRoutes(resetBalls, source.objective.nextBallId, source.objective.maxCutAngle),
    removedRoutes: directShotRoutes(balls.filter(b => b.id !== blockerId), source.objective.nextBallId, source.objective.maxCutAngle) };
}

export function movingTrafficPairFinder(source: Scenario) {
  const cache = new Map<Opening, ReturnType<typeof movingTrafficEvidence>>();
  const evidence = (e: Opening) => {
    if (!cache.has(e)) cache.set(e, movingTrafficEvidence(source, e.simulation));
    return cache.get(e)!;
  };
  return (entries: Opening[]) => {
    if (!source.objective) return null;
    for (const blocked of entries) {
      const moved = evidence(blocked);
      if (!moved || !moved.contacted || moved.moved < .08 || moved.routes.length || !moved.resetRoutes.length) continue;
      for (const clear of entries) {
        const kept = evidence(clear);
        if (!kept || kept.moved > .001 || kept.contacted || !kept.routes.length) continue;
        const gap = distance(blocked.simulation.cueEnd, clear.simulation.cueEnd);
        if (blocked.plan.pocketId !== clear.plan.pocketId || gap < .12 || gap > source.objective.radius * 1.9) continue;
        const target = source.objective.target ?? { x: (blocked.simulation.cueEnd.x + clear.simulation.cueEnd.x) / 2, y: (blocked.simulation.cueEnd.y + clear.simulation.cueEnd.y) / 2 };
        if ([blocked, clear].some(e => distance(e.simulation.cueEnd, target) > source.objective!.radius)) continue;
        for (const route of kept.routes) {
          if (!moved.resetRoutes.some(r => r.pocketId === route.pocketId) || !moved.removedRoutes.some(r => r.pocketId === route.pocketId)) continue;
          const blockedRoute = moved.resetRoutes.find(r => r.pocketId === route.pocketId)!;
          const pocket = POCKET_GEOMETRY.find(p => p.id === route.pocketId)!;
          const approachBlocked = segmentDistance(moved.blocker.position, blocked.simulation.cueEnd, blockedRoute.ghost) < TABLE.ballDiameter * 1.025;
          const pocketBlocked = segmentDistance(moved.blocker.position, moved.balls.find(b => b.id === source.objective!.nextBallId)!.position, pocket.center) < TABLE.ballDiameter * 1.025;
          if (approachBlocked === pocketBlocked) continue;
          const nextScenario: Scenario = { level: source.level, seed: source.seed, title: 'Clear traffic continuation', description: '', conditions: source.conditions,
            balls: kept.balls.map(({ id, position }) => ({ id, position: { ...position } })) };
          for (const pace of [.95, 1.2, 1.5]) for (const spin of [0, -.7, 1]) {
            const plan = secondShotPlan(nextScenario, source.objective.nextBallId, route, pace, spin);
            const simulation = simulateShot(nextScenario, plan, { record: false, recordPaths: true });
            if (secondShotPotted(source.objective.nextBallId, simulation)) return { blocked, clear, moved, kept, target, approachBlocked, pocketBlocked, pocketId: route.pocketId, nextScenario, plan, simulation };
          }
        }
      }
    }
    return null;
  };
}
