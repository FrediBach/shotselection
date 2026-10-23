import { TABLE } from './constants';
import { clamp, distance, dot, normalize, subtract } from './math';
import { POCKET_GEOMETRY } from './table-geometry';
import type { Scenario } from './types';

export interface PlantRoute { pocketId: number; angle: number; speed: number }

/** A plant offers the line through the two ball centres. The first ball is
 * aimed at the second, so the pair's alignment with the pocket is something
 * the player must judge. Never rotate this line to manufacture a successful
 * plant: a misaligned pair must remain an available, physically simulated miss.
 * Gaps, cue cuts, collision throw and pocket jaws all affect the actual result. */
export function plantRoutesFor(scenario: Scenario, ballId: number): PlantRoute[] {
  const plant = scenario.plant;
  if (!plant || plant.ballId !== ballId) return [];
  const cue = scenario.balls.find(ball => ball.id === 0);
  const first = scenario.balls.find(ball => ball.id === ballId);
  const target = scenario.balls.find(ball => ball.id === plant.targetBallId);
  const pocket = POCKET_GEOMETRY.find(candidate => candidate.id === plant.pocketId);
  if (!cue || !first || !target || !pocket) return [];
  const pairDistance = distance(first.position, target.position);
  if (pairDistance < TABLE.ballDiameter - 1e-6) return [];
  const direction = normalize(subtract(target.position, first.position));
  const ghost = { x: first.position.x - direction.x * TABLE.ballDiameter, y: first.position.y - direction.y * TABLE.ballDiameter };
  if (ghost.x < TABLE.ballRadius || ghost.x > TABLE.length - TABLE.ballRadius
    || ghost.y < TABLE.ballRadius || ghost.y > TABLE.width - TABLE.ballRadius) return [];
  const aim = normalize(subtract(ghost, cue.position));
  const cut = dot(direction, aim);
  if (cut < 0.17) return [];
  const travel = pairDistance - TABLE.ballDiameter + distance(target.position, pocket.center);
  const speed = clamp(Math.sqrt(2 * TABLE.rollingFriction * 9.80665 * (travel + 0.2)) / (0.55 * cut)
    + distance(cue.position, ghost) * 0.2, 0.8, 3.1);
  return [{ pocketId: pocket.id, angle: Math.atan2(aim.y, aim.x), speed }];
}
