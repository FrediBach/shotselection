import { directNextShotRoutes, directShotRoutes } from './objectives';
import { secondShotPlan, secondShotPotted } from './second-shot';
import { simulateShot } from './physics';
import { distance, segmentDistance } from './math';
import { TABLE } from './constants';
import { POCKET_GEOMETRY } from './table-geometry';
import type { Opening } from './look-ahead';
import type { Scenario, Simulation } from './types';

/** Remove one named blocker from the settled layout, without moving either shot ball. */
export function zoneExitEvidence(source: Scenario, sim: Simulation, blockerId: number, pocketId: number) {
  const balls = sim.finalBalls.filter(b => !b.pocketed);
  const cue = balls.find(b => b.id === 0), next = balls.find(b => b.id === source.objective!.nextBallId), blocker = balls.find(b => b.id === blockerId);
  const routes = directNextShotRoutes(source, sim);
  const restored = sim.stopped && !sim.scratch ? directShotRoutes(balls.filter(b => b.id !== blockerId), source.objective!.nextBallId, source.objective!.maxCutAngle).find(r => r.pocketId === pocketId) : undefined;
  const pocket = POCKET_GEOMETRY.find(p => p.id === pocketId)!;
  const approachBlocked = Boolean(restored && cue && blocker && segmentDistance(blocker.position, cue.position, restored.ghost) < TABLE.ballDiameter * 1.025);
  const potLineClear = Boolean(next && blocker && segmentDistance(blocker.position, next.position, pocket.center) >= TABLE.ballDiameter * 1.025);
  return { cue, next, blocker, pocket, routes, restored, approachBlocked, potLineClear, route: routes.find(r => r.pocketId === pocketId) };
}

export function zoneExitPairFinder(source: Scenario) {
  const cache = new Map<Opening, ReturnType<typeof directNextShotRoutes>>();
  const routes = (e: Opening) => {
    if (!cache.has(e)) cache.set(e, directNextShotRoutes(source, e.simulation));
    return cache.get(e)!;
  };
  const unchanged = (e: Opening) => secondShotPotted(1, e.simulation) && source.balls.filter(b => b.id > 1).every(b => {
    const end = e.simulation.finalBalls.find(c => c.id === b.id && !c.pocketed);
    return end && distance(end.position, b.position) < .001;
  });
  return (entries: Opening[]) => {
    for (const blocked of entries.filter(e => unchanged(e) && !routes(e).length)) {
      for (const clear of entries.filter(e => unchanged(e) && routes(e).length)) {
        const gap = distance(blocked.simulation.cueEnd, clear.simulation.cueEnd);
        if (blocked.plan.pocketId !== clear.plan.pocketId || gap < .12 || gap > source.objective!.radius * 1.9
          || Math.max(blocked.plan.speed, clear.plan.speed) / Math.min(blocked.plan.speed, clear.plan.speed) > 1.7) continue;
        const target = source.objective!.target ?? { x: (blocked.simulation.cueEnd.x + clear.simulation.cueEnd.x) / 2, y: (blocked.simulation.cueEnd.y + clear.simulation.cueEnd.y) / 2 };
        if ([blocked, clear].some(e => distance(e.simulation.cueEnd, target) > source.objective!.radius)) continue;
        for (const blocker of source.balls.filter(b => b.id > 2)) for (const route of routes(clear)) {
          const evidence = zoneExitEvidence(source, blocked.simulation, blocker.id, route.pocketId);
          if (!evidence.restored || !evidence.approachBlocked || !evidence.potLineClear) continue;
          const nextScenario: Scenario = { level: source.level, seed: source.seed, title: 'Clear exit proof', description: '', conditions: source.conditions,
            balls: clear.simulation.finalBalls.filter(b => !b.pocketed).map(({ id, position }) => ({ id, position: { ...position } })) };
          for (const pace of [.95, 1.2, 1.5]) for (const spin of [0, -.7, 1]) {
            const plan = secondShotPlan(nextScenario, 2, route, pace, spin);
            const simulation = simulateShot(nextScenario, plan, { record: false, recordPaths: true });
            if (secondShotPotted(2, simulation)) return { blocked, clear, blockerId: blocker.id, pocketId: route.pocketId, target, nextScenario, plan, simulation };
          }
        }
      }
    }
    return null;
  };
}
