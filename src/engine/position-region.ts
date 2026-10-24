import { distance } from './math';
import type { PositionObjective, Vec2 } from './types';

/** One shared boundary for scoring, tolerance trials and preparation. */
export function positionRegionRatio(objective: PositionObjective, point: Vec2): number {
  if (!objective.target) throw new Error('Position regions need a prepared center.');
  if (!objective.ellipse) return distance(point, objective.target) / objective.radius;
  const dx = point.x - objective.target.x, dy = point.y - objective.target.y;
  const c = Math.cos(objective.ellipse.angle), s = Math.sin(objective.ellipse.angle);
  return Math.hypot((dx * c + dy * s) / objective.ellipse.longRadius, (-dx * s + dy * c) / objective.radius);
}
