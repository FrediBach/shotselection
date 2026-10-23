import { TABLE } from './constants';
import { clamp } from './math';
import type { ShotPlan, TableConditions, Vec2 } from './types';

/** Keep defects authored in table coordinates aligned with mirrored layouts. */
export function reflectTableConditions(conditions: TableConditions, mirrorX: boolean, mirrorY: boolean): TableConditions {
  const side = (rail: NonNullable<TableConditions['cushions']>[number]['rail']) => {
    if (mirrorX && (rail === 'left' || rail === 'right')) return rail === 'left' ? 'right' : 'left';
    if (mirrorY && (rail === 'top' || rail === 'bottom')) return rail === 'top' ? 'bottom' : 'top';
    return rail;
  };
  return {
    ...conditions,
    ...(conditions.nap ? { nap: { x: conditions.nap.x * (mirrorX ? -1 : 1), y: conditions.nap.y * (mirrorY ? -1 : 1) } } : {}),
    ...(conditions.patches ? { patches: conditions.patches.map(patch => ({ ...patch, center: {
      x: mirrorX ? TABLE.length - patch.center.x : patch.center.x,
      y: mirrorY ? TABLE.width - patch.center.y : patch.center.y,
    } })) } : {}),
    ...(conditions.cushions ? { cushions: conditions.cushions.map(cushion => ({ ...cushion, rail: side(cushion.rail) })) } : {}),
    ...(conditions.cue ? { cue: { ...conditions.cue, angleBias: conditions.cue.angleBias * (mirrorX !== mirrorY ? -1 : 1) } } : {}),
  };
}

/** Local cloth speed, shared by simulation and route preparation. */
export function clothFrictionAt(position: Vec2, conditions?: TableConditions): number {
  if (!conditions) return 1;
  let friction = conditions.cloth ?? 1;
  for (const patch of conditions.patches ?? []) {
    if (Math.hypot(position.x - patch.center.x, position.y - patch.center.y) <= patch.radius) friction *= patch.friction;
  }
  return clamp(friction, 0.2, 6) * (1 + 0.15 * clamp(conditions.dirt ?? 0, 0, 1));
}

/** The cue defect is fixed for the level, never an extra random trial error. */
export function cueStroke(plan: Pick<ShotPlan, 'speed' | 'angle' | 'topSpin' | 'sideSpin'>, conditions?: TableConditions) {
  const cue = conditions?.cue;
  const spin = clamp(cue?.spin ?? 1, 0, 2);
  return {
    speed: clamp(clamp(plan.speed, 0.05, 4) * clamp(cue?.power ?? 1, 0.1, 1.5), 0.005, 4),
    angle: plan.angle + (cue?.angleBias ?? 0),
    topSpin: plan.topSpin * spin,
    sideSpin: plan.sideSpin * spin,
  };
}
