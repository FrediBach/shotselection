import { TABLE } from './constants';
import { directShotRoutes } from './objectives';
import { distance, segmentDistance } from './math';
import { POCKET_GEOMETRY } from './table-geometry';
import { secondShotPlan, secondShotPotted } from './second-shot';
import { simulateShot } from './physics';
import type { DirectShotRoute } from './objectives';
import type { Opening } from './look-ahead';
import type { Scenario } from './types';

function pot(scenario: Scenario, route: DirectShotRoute) {
  for (const pace of [.95, 1.2, 1.5]) for (const spin of [0, -.7, 1]) {
    const plan = secondShotPlan(scenario, 2, route, pace, spin);
    const simulation = simulateShot(scenario, plan, { record: false, recordPaths: true });
    if (secondShotPotted(2, simulation)) return { scenario, plan, simulation };
  }
  return null;
}

/** A blocked preferred pocket plus a clear alternative that needs a different finish. */
export function pocketChangePairFinder(source: Scenario) {
  const cache = new Map<Opening, ReturnType<typeof inspect>>();
  function inspect(opening: Opening) {
    if (!source.objective || !secondShotPotted(1, opening.simulation)) return null;
    const balls = opening.simulation.finalBalls.filter(b => !b.pocketed).map(({ id, position }) => ({ id, position: { ...position } }));
    if (source.balls.filter(b => b.id > 1).some(b => {
      const end = balls.find(c => c.id === b.id);
      return !end || distance(end.position, b.position) > .001;
    })) return null;
    const scenario: Scenario = { level: source.level, seed: source.seed, title: 'Compare next pockets', description: '', conditions: source.conditions, balls };
    return { scenario, routes: directShotRoutes(balls, 2, source.objective.maxCutAngle), relaxed: directShotRoutes(balls, 2, 89.9),
      removals: balls.filter(b => b.id > 2).map(blocker => ({ blocker, scenario: { ...scenario, balls: balls.filter(b => b.id !== blocker.id) },
        routes: directShotRoutes(balls.filter(b => b.id !== blocker.id), 2, source.objective!.maxCutAngle) })) };
  }
  const evidence = (opening: Opening) => {
    if (!cache.has(opening)) cache.set(opening, inspect(opening));
    return cache.get(opening)!;
  };
  return (entries: Opening[]) => {
    if (!source.objective) return null;
    for (const original of entries) {
      const old = evidence(original);
      if (!old || old.routes.length) continue;
      for (const removed of old.removals) for (const preferred of removed.routes) {
        const pocket = POCKET_GEOMETRY.find(p => p.id === preferred.pocketId)!;
        const object = old.scenario.balls.find(b => b.id === 2)!;
        if (segmentDistance(removed.blocker.position, object.position, pocket.center) >= TABLE.ballDiameter
          || segmentDistance(removed.blocker.position, original.simulation.cueEnd, preferred.ghost) < TABLE.ballDiameter * 1.025) continue;
        for (const adapted of entries) {
          const next = evidence(adapted);
          if (!next || original.plan.pocketId !== adapted.plan.pocketId) continue;
          const gap = distance(original.simulation.cueEnd, adapted.simulation.cueEnd);
          if (gap < .12 || gap > source.objective.radius * 1.9) continue;
          const target = source.objective.target ?? { x: (original.simulation.cueEnd.x + adapted.simulation.cueEnd.x) / 2, y: (original.simulation.cueEnd.y + adapted.simulation.cueEnd.y) / 2 };
          if ([original, adapted].some(e => distance(e.simulation.cueEnd, target) > source.objective!.radius)) continue;
          for (const alternate of next.routes.filter(r => r.pocketId !== preferred.pocketId)) {
            const oldAlternate = old.relaxed.find(r => r.pocketId === alternate.pocketId && r.cutAngle >= source.objective!.maxCutAngle + 5 && r.cutAngle >= alternate.cutAngle + 8);
            if (!oldAlternate) continue;
            const preferredProof = pot(removed.scenario, preferred), alternateProof = pot(next.scenario, alternate);
            if (preferredProof && alternateProof) return { original, adapted, old, next, blocker: removed.blocker, preferred, alternate, oldAlternate, target, preferredProof, alternateProof };
          }
        }
      }
    }
    return null;
  };
}
