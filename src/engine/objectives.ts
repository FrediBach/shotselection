import { positionToleranceForLevel, TABLE } from './constants';
import { clamp, distance, dot, normalize, segmentDistance, subtract } from './math';
import { simulateShot } from './physics';
import { POCKET_GEOMETRY, RAILS } from './table-geometry';
import type { Ball, Scenario, ShotPlan, Simulation, Vec2 } from './types';

export interface DirectShotRoute {
  pocketId: number;
  ghost: Vec2;
  angle: number;
  speed: number;
  cutAngle: number;
}

function crosses(a: Vec2, b: Vec2, c: Vec2, d: Vec2): boolean {
  const side = (p: Vec2, q: Vec2, r: Vec2) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  return side(a, b, c) * side(a, b, d) <= 0 && side(c, d, a) * side(c, d, b) <= 0
    && Math.max(Math.min(a.x, b.x), Math.min(c.x, d.x)) <= Math.min(Math.max(a.x, b.x), Math.max(c.x, d.x))
    && Math.max(Math.min(a.y, b.y), Math.min(c.y, d.y)) <= Math.min(Math.max(a.y, b.y), Math.max(c.y, d.y));
}

function clearsRails(start: Vec2, end: Vec2): boolean {
  return !RAILS.some(({ a, b }) => crosses(start, end, a, b)
    || Math.min(segmentDistance(a, start, end), segmentDistance(b, start, end), segmentDistance(start, a, b), segmentDistance(end, a, b)) < TABLE.ballRadius);
}

/** Direct routes use the ghost-ball contact point, both swept ball corridors,
 * pocket jaws and a maximum cut angle. They do not predict throw or pace. */
export function directShotRoutes(balls: Ball[], ballId: number, maxCutAngle: number): DirectShotRoute[] {
  const cue = balls.find(ball => ball.id === 0);
  const object = balls.find(ball => ball.id === ballId);
  if (!cue || !object || distance(cue.position, object.position) < TABLE.ballDiameter) return [];
  const blockers = balls.filter(ball => ball.id !== 0 && ball.id !== ballId);
  const routes: DirectShotRoute[] = [];
  for (const pocket of POCKET_GEOMETRY) {
    const direction = normalize(subtract(pocket.center, object.position));
    const ghost = { x: object.position.x - direction.x * TABLE.ballDiameter, y: object.position.y - direction.y * TABLE.ballDiameter };
    if (ghost.x < TABLE.ballRadius || ghost.x > TABLE.length - TABLE.ballRadius || ghost.y < TABLE.ballRadius || ghost.y > TABLE.width - TABLE.ballRadius) continue;
    const aim = normalize(subtract(ghost, cue.position));
    const cut = dot(direction, aim);
    const cutAngle = Math.acos(clamp(cut, -1, 1)) * 180 / Math.PI;
    if (cut <= 0 || cutAngle > maxCutAngle) continue;
    if (blockers.some(ball => segmentDistance(ball.position, cue.position, ghost) < TABLE.ballDiameter * 1.025
      || segmentDistance(ball.position, object.position, pocket.center) < TABLE.ballDiameter * 1.025)) continue;
    if (!clearsRails(cue.position, ghost) || !clearsRails(object.position, pocket.center)) continue;
    const speed = clamp(Math.sqrt(2 * TABLE.rollingFriction * 9.80665 * (distance(object.position, pocket.center) + 0.13)) / (0.71 * cut) + distance(cue.position, ghost) * 0.2, 0.65, 2.8);
    routes.push({ pocketId: pocket.id, ghost, angle: Math.atan2(aim.y, aim.x), speed, cutAngle });
  }
  return routes.sort((a, b) => a.cutAngle - b.cutAngle || a.speed - b.speed);
}

/** Uses the actual settled balls, including moved blockers and the next ball.
 * Ensemble/tolerance trials use this geometry test; a selected nominal landing
 * zone additionally receives a simulated next-pot proof during preparation. */
export function directNextShotRoutes(scenario: Scenario, simulation: Simulation): DirectShotRoute[] {
  if (!scenario.objective || simulation.scratch || !simulation.stopped) return [];
  return directShotRoutes(simulation.finalBalls.filter(ball => !ball.pocketed), scenario.objective.nextBallId, scenario.objective.maxCutAngle);
}

/** A zone is offered only if an actual follow-up stroke can legally pot the
 * reserved ball from this endpoint. The route criterion above still applies. */
export function hasProvenNextShot(scenario: Scenario, simulation: Simulation): boolean {
  if (!scenario.objective) return false;
  const nextBallId = scenario.objective.nextBallId;
  const nextLayout = { ...scenario, balls: simulation.finalBalls.filter(ball => !ball.pocketed).map(({ id, position }) => ({ id, position })) };
  for (const route of directNextShotRoutes(scenario, simulation)) {
    for (const multiplier of [0.95, 1.2, 1.5]) {
      for (const topSpin of [0, -0.7, 1]) {
        const plan: ShotPlan = { id: 'next-shot-proof', ballId: nextBallId, pocketId: route.pocketId, target: simulation.cueEnd, angle: route.angle, speed: Math.min(3.6, route.speed * multiplier), topSpin, sideSpin: 0, label: 'Next-ball check' };
        const next = simulateShot(nextLayout, plan, { record: false });
        if (next.stopped && !next.scratch && next.firstContact === nextBallId && next.potted.includes(nextBallId)) return true;
      }
    }
  }
  return false;
}

export function positionToleranceForScenario(scenario: Scenario): number {
  return scenario.objective?.radius ?? positionToleranceForLevel(scenario.level);
}

/** One predicate shared by scoring and sensitivity analysis. Individual option
 * markers remain nominal endpoints; position lessons use one common zone. */
export function evaluateShotObjective(scenario: Scenario, plan: ShotPlan, simulation: Simulation) {
  const objective = scenario.objective;
  if (objective && !objective.target) throw new Error('Position lessons need a prepared landing zone.');
  const target = objective?.target ?? plan.target;
  const radius = positionToleranceForScenario(scenario);
  const error = distance(simulation.cueEnd, target);
  const legalPot = simulation.stopped && !simulation.scratch && simulation.firstContact === plan.ballId
    && simulation.potted.includes(plan.ballId) && (!objective || plan.ballId === objective.ballId);
  const positioned = simulation.stopped && !simulation.scratch && error <= radius;
  const nextShotAvailable = !objective || directNextShotRoutes(scenario, simulation).length > 0;
  return { legalPot, positioned, nextShotAvailable, success: legalPot && positioned && nextShotAvailable, error, radius };
}
