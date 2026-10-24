import { TABLE } from './constants';
import { distance, dot, subtract } from './math';
import { directShotRoutes, hasProvenNextShot } from './objectives';
import { secondShotPlan, secondShotPotted } from './second-shot';
import { simulateShot } from './physics';
import { positionRegionRatio } from './position-region';
import type { Opening } from './look-ahead';
import type { PositionObjective, Scenario, Vec2 } from './types';

/** The connecting strip outside the two disks; an endpoint here fails the region requirement. */
export function inPositionGap(objective: PositionObjective, point: Vec2) {
  if (!objective.regions || positionRegionRatio(objective, point) <= 1) return false;
  const [a, b] = objective.regions, ab = subtract(b, a), length2 = dot(ab, ab);
  const t = dot(subtract(point, a), ab) / length2;
  return t > 0 && t < 1 && distance(point, { x: a.x + t * ab.x, y: a.y + t * ab.y }) <= objective.radius;
}

/** Two real legal openers, with an otherwise identical settled layout and a blocked midpoint. */
export function disconnectedPositionFinder(source: Scenario) {
  const proofs = new Map<Opening, boolean>();
  const valid = (e: Opening) => {
    if (!proofs.has(e)) proofs.set(e, secondShotPotted(1, e.simulation) && e.simulation.potted.length === 1 && e.simulation.ballContacts?.length === 1
      && source.balls.filter(b => b.id > 1).every(b => {
        const end = e.simulation.finalBalls.find(c => c.id === b.id && !c.pocketed);
        return end && distance(b.position, end.position) < 1e-6;
      }) && hasProvenNextShot(source, e.simulation));
    return proofs.get(e)!;
  };
  const inspect = (a: Opening, b: Opening) => {
    if (!source.objective) return null;
    const radius = source.objective.radius;
    const centers: [Vec2, Vec2] = [a.simulation.cueEnd, b.simulation.cueEnd];
    const separation = distance(...centers);
    if (a.plan.pocketId !== b.plan.pocketId || separation < radius * 2 + .06 || separation > .85
      || centers.some(p => p.x < radius + .03 || p.x > TABLE.length - radius - .03 || p.y < radius + .03 || p.y > TABLE.width - radius - .03)) return null;
    const midpoint = { x: (centers[0].x + centers[1].x) / 2, y: (centers[0].y + centers[1].y) / 2 };
    const balls = a.simulation.finalBalls.filter(b => !b.pocketed).map(b => ({ id: b.id, position: b.id === 0 ? midpoint : b.position }));
    if (balls.some(b => b.id !== 0 && distance(b.position, midpoint) < TABLE.ballDiameter)
      || directShotRoutes(balls, source.objective.nextBallId, source.objective.maxCutAngle).length || !valid(a) || !valid(b)) return null;
    for (const blocker of balls.filter(b => b.id > 2)) {
      const removed: Scenario = { level: source.level, seed: source.seed, title: 'Midpoint removal proof', description: '', conditions: source.conditions, balls: balls.filter(b => b.id !== blocker.id) };
      for (const route of directShotRoutes(removed.balls, source.objective.nextBallId, source.objective.maxCutAngle)) {
        for (const pace of [.95, 1.2, 1.5]) for (const spin of [0, -.7, 1]) {
          const plan = secondShotPlan(removed, source.objective.nextBallId, route, pace, spin);
          const simulation = simulateShot(removed, plan, { record: false, recordPaths: true });
          if (!secondShotPotted(source.objective.nextBallId, simulation)) continue;
          const blocked = { ...removed, balls };
          const blockedSimulation = simulateShot(blocked, plan, { record: false, recordPaths: true });
          if (!blockedSimulation.stopped || blockedSimulation.scratch || blockedSimulation.firstContact !== blocker.id || secondShotPotted(source.objective.nextBallId, blockedSimulation)) continue;
          return { a, b, centers, midpoint, blockerId: blocker.id, pocketId: route.pocketId, ghost: route.ghost, blocked, removed, plan, blockedSimulation, removalSimulation: simulation };
        }
      }
    }
    return null;
  };
  const cache = new Map<Opening, Map<Opening, ReturnType<typeof inspect>>>();
  return (entries: Opening[]) => {
    for (let i = 0; i < entries.length; i++) for (let j = i + 1; j < entries.length; j++) {
      const a = entries[i], b = entries[j];
      if (!cache.has(a)) cache.set(a, new Map());
      const row = cache.get(a)!;
      if (!row.has(b)) row.set(b, inspect(a, b));
      const evidence = row.get(b);
      if (evidence) return evidence;
    }
    return null;
  };
}
export type DisconnectedPositionPreview = Omit<NonNullable<ReturnType<ReturnType<typeof disconnectedPositionFinder>>>, 'a' | 'b'> & { optionIds: [string, string] };
