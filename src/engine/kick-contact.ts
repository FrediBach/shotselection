import { TABLE } from './constants';
import { clamp, distance, dot, normalize, subtract } from './math';
import { kickIntroductionEvidence } from './kick-introduction';
import { POCKET_GEOMETRY } from './table-geometry';
import type { Scenario, ShotPlan, Simulation, Vec2 } from './types';

export interface KickContactPreview {
  referenceId: string; pocketId: number; object: Vec2; pocket: Vec2; rebound: Vec2;
  ghost: Vec2; centerHit: Vec2; contactPoint: Vec2; direction: Vec2; centerDirection: Vec2;
  angle: number; approach: Vec2[];
}
/** Two geometric final legs from one recorded rebound. The center-directed leg
 * is an illustration, not a second feasible stroke or a physical miss replay. */
export function kickContactEvidence(source: Scenario, plan: ShotPlan, simulation: Simulation): KickContactPreview | null {
  const kick = kickIntroductionEvidence(source, simulation);
  const object = source.balls.find(b => b.id === plan.ballId)?.position;
  const pocket = POCKET_GEOMETRY.find(p => p.id === plan.pocketId)?.center;
  if (!kick || !object || !pocket || kick.rebounds.length !== 1 || simulation.objectCushions !== 0
    || plan.ballId !== source.bank?.ballId || kick.contact.objectSpeedBefore > 1e-6) return null;
  const direction = normalize(subtract(pocket, object));
  const centerDirection = normalize(subtract(object, kick.first.position));
  const angle = Math.acos(clamp(dot(direction, centerDirection), -1, 1)) * 180 / Math.PI;
  const ghost = { x: object.x - direction.x * TABLE.ballDiameter, y: object.y - direction.y * TABLE.ballDiameter };
  // Require a visible difference and a nominal pot contacting near the ideal side.
  if (angle < 10 || angle > 65 || distance(ghost, kick.contact.position) > .008) return null;
  return { referenceId: plan.id, pocketId: plan.pocketId, object, pocket, rebound: kick.first.position,
    ghost, centerHit: { x: object.x - centerDirection.x * TABLE.ballDiameter, y: object.y - centerDirection.y * TABLE.ballDiameter },
    contactPoint: { x: object.x - direction.x * TABLE.ballRadius, y: object.y - direction.y * TABLE.ballRadius },
    direction, centerDirection, angle, approach: kick.incoming };
}
