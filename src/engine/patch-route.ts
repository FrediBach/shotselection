import { distance } from './math';
import type { Scenario, ShotPlan, Simulation, Vec2 } from './types';

/** Clip the recorded polyline, not the continuous simulated trajectory. */
export function clipPatchPath(path: Vec2[], center: Vec2, radius: number): [Vec2, Vec2][] {
  if (!(radius > 0)) return [];
  const segments: [Vec2, Vec2][] = [];
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i], dx = b.x - a.x, dy = b.y - a.y;
    const x = a.x - center.x, y = a.y - center.y, aa = dx * dx + dy * dy;
    if (!aa) continue;
    const bb = 2 * (x * dx + y * dy), cc = x * x + y * y - radius * radius;
    const discriminant = bb * bb - 4 * aa * cc;
    if (discriminant <= 0) continue;
    const root = Math.sqrt(discriminant);
    const enter = Math.max(0, (-bb - root) / (2 * aa)), exit = Math.min(1, (-bb + root) / (2 * aa));
    if (exit <= enter) continue;
    segments.push([{ x: a.x + enter * dx, y: a.y + enter * dy }, { x: a.x + exit * dx, y: a.y + exit * dy }]);
  }
  return segments;
}

export function patchRouteReplay(source: Scenario, plan: ShotPlan, sim: Simulation) {
  const patches = source.conditions?.patches;
  const contact = sim.contactEvents?.find(e => e.ballIds.includes(0) && e.ballIds.includes(plan.ballId));
  if (!patches?.length || !sim.frames.length || !contact?.balls) return null;
  const cue = contact.balls.find(b => b.id === 0), object = contact.balls.find(b => b.id === plan.ballId);
  if (!cue || !object) return null;
  const after = (id: number, start: Vec2) => {
    const path = [start];
    for (const frame of sim.frames) {
      if (frame.time <= contact.time) continue;
      const ball = frame.balls.find(b => b.id === id);
      if (!ball) return [];
      path.push(ball.position);
      if (ball.pocketed) break;
    }
    return path;
  };
  const approach = sim.frames.filter(f => f.time < contact.time).map(f => f.balls.find(b => b.id === 0)?.position);
  if (approach.some(p => !p)) return null;
  const routes = [
    { label: 'Cue before contact', ballId: 0, path: [...approach as Vec2[], cue.position] },
    { label: 'Cue after contact', ballId: 0, path: after(0, cue.position) },
    { label: `Ball ${plan.ballId} after contact`, ballId: plan.ballId, path: after(plan.ballId, object.position) },
  ];
  if (routes.some(r => r.path.length < 2)) return null;
  return { contact, patches, routes: routes.map(route => ({ ...route,
    crossings: patches.map(patch => {
      const segments = clipPatchPath(route.path, patch.center, patch.radius);
      return { patchId: patch.id, segments, length: segments.reduce((sum, [a, b]) => sum + distance(a, b), 0) };
    }),
  })) };
}
