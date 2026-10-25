import { positionRegionRatio } from './position-region';
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

export function clearsRails(start: Vec2, end: Vec2): boolean {
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

/** First two chapters teach potting; their finish markers are predictions, not scoring zones. */
export function scoresPosition(scenario: Scenario): boolean {
  return !scenario.finalBall && (scenario.scoring?.position ?? (Boolean(scenario.objective || scenario.bank || scenario.plant || scenario.trick || scenario.conditions) || scenario.level > 20));
}

export function positionToleranceForScenario(scenario: Scenario): number {
  return !scoresPosition(scenario) ? 0 : scenario.objective?.radius ?? scenario.scoring?.tolerance ?? positionToleranceForLevel(scenario.level);
}

export function satisfiesTrick(scenario: Scenario, plan: ShotPlan, simulation: Simulation): boolean {
  const trick = scenario.trick;
  if (!trick) return true;
  if (plan.ballId !== trick.ballId || (plan.potBallId ?? plan.ballId) !== trick.potBallId
    || plan.pocketId !== trick.pocketId || !trick.requiredPots.every(id => simulation.potted.includes(id))
    || (simulation.objectCushions ?? 0) < (trick.minObjectCushions ?? 0)) return false;
  const pocket = POCKET_GEOMETRY.find(candidate => candidate.id === trick.pocketId);
  const pottedBall = simulation.finalBalls.find(ball => ball.id === trick.potBallId);
  if (!pocket || !pottedBall?.pocketed || distance(pottedBall.position, pocket.center) >= pocket.radius) return false;
  let next = 0;
  for (const [a, b] of simulation.ballContacts ?? []) {
    const expected = trick.requiredContacts[next];
    if (expected && ((a === expected[0] && b === expected[1]) || (a === expected[1] && b === expected[0]))) next++;
  }
  return next === trick.requiredContacts.length;
}

/** Restore only the blocker at the actual settled cue position. The next route
 * must be newly available, not merely accompanied by an incidental contact. */
export function plannedMovementOutcome(scenario: Scenario, simulation: Simulation) {
  const requirement = scenario.plannedMovement, objective = scenario.objective;
  if (!requirement || !objective) return { contact: false, opened: false };
  const contacts = simulation.ballContacts ?? [];
  const first = contacts.findIndex(([a, b]) => a === 0 && b === objective.ballId || b === 0 && a === objective.ballId);
  const contact = first >= 0 && contacts.slice(first + 1).some(([a, b]) => a === 0 && b === requirement.blockerId || b === 0 && a === requirement.blockerId);
  const original = scenario.balls.find(b => b.id === requirement.blockerId);
  const moved = simulation.finalBalls.find(b => b.id === requirement.blockerId);
  if (!contact || !original || !moved || moved.pocketed || distance(original.position, moved.position) < .03
    || !simulation.stopped || simulation.scratch) return { contact, opened: false };
  const restored = simulation.finalBalls.filter(b => !b.pocketed).map(b => b.id === original.id ? original : b);
  const opened = directNextShotRoutes(scenario, simulation).length > 0
    && directShotRoutes(restored, objective.nextBallId, objective.maxCutAngle).length === 0;
  return { contact, opened };
}

/** One predicate shared by scoring and sensitivity analysis. Individual option
 * markers remain nominal endpoints; position lessons use one common zone. */
export function evaluateShotObjective(scenario: Scenario, plan: ShotPlan, simulation: Simulation) {
  const objective = scenario.objective;
  if (objective && !objective.target) throw new Error('Position lessons need a prepared landing zone.');
  const target = objective?.target ?? plan.target;
  const radius = positionToleranceForScenario(scenario);
  const error = !scoresPosition(scenario) ? 0 : objective?.regions ? Math.min(...objective.regions.map(center => distance(simulation.cueEnd, center))) : distance(simulation.cueEnd, target);
  const banksSatisfied = !scenario.bank || (plan.ballId === scenario.bank.ballId
    && (simulation.cueBanksBeforeContact ?? 0) >= scenario.bank.minCushions);
  const potBallId = plan.potBallId ?? plan.ballId;
  const plantSatisfied = !scenario.plant || (plan.ballId === scenario.plant.ballId
    ? potBallId === scenario.plant.targetBallId && plan.pocketId === scenario.plant.pocketId
    : plan.ballId !== scenario.plant.targetBallId && potBallId === plan.ballId);
  const legalPot = simulation.stopped && !simulation.scratch && simulation.firstContact === plan.ballId
    && (!scenario.finalBall || plan.ballId === scenario.finalBall.ballId && potBallId === scenario.finalBall.ballId)
    && simulation.potted.includes(potBallId) && (!objective || plan.ballId === objective.ballId) && banksSatisfied && plantSatisfied
    && satisfiesTrick(scenario, plan, simulation);
  const zoneRatio = !scoresPosition(scenario) ? 0 : objective ? positionRegionRatio(objective, simulation.cueEnd) : error / radius;
  const positioned = simulation.stopped && !simulation.scratch && zoneRatio <= 1;
  const nextShotAvailable = !objective || directNextShotRoutes(scenario, simulation).length > 0;
  return { legalPot, positioned, nextShotAvailable, success: legalPot && positioned && nextShotAvailable && (!scenario.plannedMovement || plannedMovementOutcome(scenario, simulation).opened), error, radius, zoneRatio };
}
