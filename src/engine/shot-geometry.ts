import { TABLE } from './constants';
import { clamp, distance, dot, normalize, subtract } from './math';
import { POCKET_GEOMETRY } from './table-geometry';
import type { PreparedRound, Scenario, ShotPlan, Vec2 } from './types';

/** Geometry of an offered direct pot. These measures do not include throw,
 * jaw collisions or stroke uncertainty; use simulation for those outcomes. */
export function directShotGeometry(scenario: Scenario, plan: ShotPlan) {
  const cue = scenario.balls.find(ball => ball.id === 0)!.position;
  const object = scenario.balls.find(ball => ball.id === plan.ballId)!.position;
  const pocket = POCKET_GEOMETRY[plan.pocketId];
  const direction = normalize(subtract(pocket.center, object));
  const ghost = { x: object.x - direction.x * TABLE.ballDiameter, y: object.y - direction.y * TABLE.ballDiameter };
  const approach = normalize(subtract(ghost, cue));
  const cutDegrees = Math.acos(clamp(dot(direction, approach), -1, 1)) * 180 / Math.PI;
  const entryCosine = Math.abs(dot(direction, pocket.outward));
  const mouthWidth = distance(...pocket.mouth);
  return {
    cue, object, pocket, ghost, direction,
    cueDistance: distance(cue, ghost),
    objectDistance: distance(object, pocket.center),
    cutDegrees,
    entryDegrees: Math.acos(clamp(entryCosine, 0, 1)) * 180 / Math.PI,
    /** Width across this travel direction, minus a ball diameter. This is a
     * mouth-plane illustration, not a simulation-derived potting tolerance. */
    projectedClearance: Math.max(0, mouthWidth * entryCosine - TABLE.ballDiameter),
  };
}

/** Same outgoing angular error in each illustration, measured at a plane
 * through the pocket center perpendicular to the intended object-ball line. */
export function objectLineError(geometry: ReturnType<typeof directShotGeometry>, degrees = 1) {
  const displacement = geometry.objectDistance * Math.tan(degrees * Math.PI / 180);
  const endpoint: Vec2 = {
    x: geometry.pocket.center.x - geometry.direction.y * displacement,
    y: geometry.pocket.center.y + geometry.direction.x * displacement,
  };
  return { displacement, endpoint };
}

export function isGeometryComparison(comparison: string | undefined) {
  return comparison === 'object-travel' || comparison === 'off-center-cue' || comparison === 'pocket-entry';
}

export function centeredCueReference(scenario: Scenario): Scenario {
  return { ...scenario, balls: scenario.balls.map(ball => ball.id === 0 ? { ...ball, position: { x: TABLE.length / 2, y: ball.position.y } } : ball) };
}

/** Reject a prepared set that no longer demonstrates its authored relationship.
 * These checks supplement feasibility; they never rank strokes for the player. */
export function supportsGeometryComparison(round: PreparedRound): boolean {
  const comparison = round.scenario.curriculum?.learning?.comparison;
  if (!isGeometryComparison(comparison)) return true;
  if (round.balls.length !== 2 || round.balls.some(ball => ball.options.some(option => option.plan.pocketId !== ball.options[0].plan.pocketId))) return false;
  const [a, b] = round.balls.map(ball => directShotGeometry(round.scenario, ball.options[0].plan));
  if (comparison === 'object-travel') return Math.abs(a.cueDistance - b.cueDistance) < 0.03
    && Math.abs(a.cutDegrees - b.cutDegrees) < 4
    && Math.max(a.objectDistance, b.objectDistance) > Math.min(a.objectDistance, b.objectDistance) * 1.8;
  if (comparison === 'off-center-cue') {
    const centered = centeredCueReference(round.scenario);
    const [left, right] = round.balls.map(ball => directShotGeometry(centered, ball.options[0].plan));
    return Math.abs(a.object.x + b.object.x - TABLE.length) < 1e-8 && Math.abs(a.object.y - b.object.y) < 1e-8
      && Math.abs(left.cutDegrees - right.cutDegrees) < 1e-6 && Math.abs(a.cutDegrees - b.cutDegrees) > 5;
  }
  const side = [a, b].find(g => g.pocket.kind === 'side');
  const corner = [a, b].find(g => g.pocket.kind === 'corner');
  return Boolean(side && corner && corner.cutDegrees - side.cutDegrees > 5 && side.entryDegrees - corner.entryDegrees > 25
    && corner.projectedClearance - side.projectedClearance > 0.008);
}
