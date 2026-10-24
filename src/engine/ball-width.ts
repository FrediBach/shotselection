import { TABLE } from './constants';
import { directShotRoutes } from './objectives';
import { segmentDistance, clamp, dot, subtract } from './math';
import { POCKET_GEOMETRY } from './table-geometry';
import { secondShotPlan, secondShotPotted } from './second-shot';
import { simulateShot } from './physics';
import type { DirectShotRoute } from './objectives';
import type { Scenario, Vec2 } from './types';

export const WIDTH_CUT_LIMIT = 80;
export function widthCorridors(source: Scenario, ballId: number, route: DirectShotRoute) {
  const cue = source.balls.find(b => b.id === 0)!, object = source.balls.find(b => b.id === ballId)!;
  const pocket = POCKET_GEOMETRY.find(p => p.id === route.pocketId)!;
  const legs = [{ kind: 'cue approach', start: cue.position, end: route.ghost }, { kind: 'object-to-pocket line', start: object.position, end: pocket.center }];
  const clearances = legs.flatMap(leg => source.balls.filter(b => b.id !== 0 && b.id !== ballId).map(blocker => ({ ...leg, blocker, distance: segmentDistance(blocker.position, leg.start, leg.end) })));
  return { cue, object, pocket, legs, clearances, minimum: Math.min(...clearances.map(c => c.distance)) };
}
export function nearestPoint(point: Vec2, start: Vec2, end: Vec2) {
  const v = subtract(end, start), t = clamp(dot(subtract(point, start), v) / (dot(v, v) || 1), 0, 1);
  return { x: start.x + t * v.x, y: start.y + t * v.y };
}

/** The line misses every physical blocker, yet its swept disk overlaps one.
 * Removing only that blocker restores the same pocket under unchanged checks. */
export function ballWidthEvidence(source: Scenario) {
  if (!source.balls.some(b => b.id === 0)) return null;
  for (const object of source.balls.filter(b => b.id > 0)) {
    const actual = directShotRoutes(source.balls, object.id, WIDTH_CUT_LIMIT);
    const wide = actual.map(route => ({ route, ...widthCorridors(source, object.id, route) })).filter(e => e.minimum >= TABLE.ballDiameter + .025);
    if (!wide.length) continue;
    for (const blocker of source.balls.filter(b => b.id !== 0 && b.id !== object.id)) {
      for (const route of directShotRoutes(source.balls.filter(b => b.id !== blocker.id), object.id, WIDTH_CUT_LIMIT)) {
        if (actual.some(r => r.pocketId === route.pocketId)) continue;
        const narrow = { route, ...widthCorridors(source, object.id, route) };
        if (narrow.minimum <= TABLE.ballRadius + .005) continue;
        const hits = narrow.clearances.filter(c => c.distance < TABLE.ballDiameter);
        if (hits.length !== 1 || hits[0].blocker.id !== blocker.id || hits[0].distance > TABLE.ballDiameter - .005) continue;
        const obstruction = hits[0], closest = nearestPoint(blocker.position, obstruction.start, obstruction.end);
        for (const clear of wide) for (const pace of [.95, 1.2, 1.5]) for (const spin of [0, -.7, 1]) {
          const plan = secondShotPlan(source, object.id, clear.route, pace, spin);
          const simulation = simulateShot(source, plan, { record: false, recordPaths: true });
          if (secondShotPotted(object.id, simulation)) return { ballId: object.id, narrow, wide: clear, obstruction, closest, plan, simulation };
        }
      }
    }
  }
  return null;
}
