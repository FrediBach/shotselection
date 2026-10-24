import { directShotRoutes } from './objectives';
import { secondShotPotted } from './second-shot';
import { segmentDistance } from './math';
import { TABLE } from './constants';
import { POCKET_GEOMETRY } from './table-geometry';
import type { Opening } from './look-ahead';
import type { Scenario, Simulation } from './types';

export type Corridor = 'approach' | 'pocket';

/** A single-ball removal must restore the named route, under the same cut and
 * rail checks. Exactly one swept corridor intersects that ball. */
export function corridorEvidence(source: Scenario, simulation: Simulation) {
  if (!source.objective || !secondShotPotted(source.objective.ballId, simulation)) return [];
  const balls = simulation.finalBalls.filter(b => !b.pocketed);
  const cue = balls.find(b => b.id === 0)!, object = balls.find(b => b.id === source.objective!.nextBallId);
  if (!cue || !object) return [];
  const actual = directShotRoutes(balls, object.id, source.objective.maxCutAngle);
  return balls.filter(b => b.id !== 0 && b.id !== object.id).flatMap(blocker =>
    directShotRoutes(balls.filter(b => b.id !== blocker.id), object.id, source.objective!.maxCutAngle).flatMap(route => {
      if (actual.some(r => r.pocketId === route.pocketId)) return [];
      const pocket = POCKET_GEOMETRY.find(p => p.id === route.pocketId)!;
      const approach = segmentDistance(blocker.position, cue.position, route.ghost) < TABLE.ballDiameter * 1.025;
      const pot = segmentDistance(blocker.position, object.position, pocket.center) < TABLE.ballDiameter * 1.025;
      if (approach === pot) return [];
      return [{ corridor: (approach ? 'approach' : 'pocket') as Corridor, blocker, route, pocket, cue, object, balls }];
    }));
}

export function corridorPairFinder(source: Scenario) {
  const cache = new Map<Opening, ReturnType<typeof corridorEvidence>>();
  const evidence = (entry: Opening) => {
    if (!cache.has(entry)) cache.set(entry, corridorEvidence(source, entry.simulation));
    return cache.get(entry)!;
  };
  return (entries: Opening[]) => {
    for (const a of entries) for (const approach of evidence(a).filter(e => e.corridor === 'approach')) {
      for (const b of entries.filter(e => e !== a)) for (const pocket of evidence(b).filter(e => e.corridor === 'pocket' && e.blocker.id !== approach.blocker.id)) {
        return [{ opening: a, evidence: approach }, { opening: b, evidence: pocket }];
      }
    }
    return null;
  };
}
