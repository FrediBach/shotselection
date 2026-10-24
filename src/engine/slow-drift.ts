import { distance } from './math';
import type { Scenario, Simulation } from './types';

/** A contiguous sampled slow tail after the cue's last collision or rebound.
 * Speeds are frame-to-frame averages, not instantaneous velocity readings. */
export function slowDriftReplay(source: Scenario, simulation: Simulation) {
  const nap = source.conditions?.nap;
  if (!nap || !Math.hypot(nap.x, nap.y) || !simulation.contactEvents?.length || simulation.scratch) return null;
  const lastImpact = Math.max(...simulation.contactEvents.filter(e => e.ballIds.includes(0)).map(e => e.time), ...(simulation.cueRebounds ?? []).map(e => e.time));
  const samples = simulation.frames.map(frame => ({ time: frame.time, ball: frame.balls.find(b => b.id === 0) }));
  if (samples.some(s => !s.ball || s.ball.pocketed)) return null;
  const intervals = samples.slice(1).map((end, i) => {
    const start = samples[i], elapsed = end.time - start.time;
    return { start, end, speed: elapsed > 0 ? distance(start.ball!.position, end.ball!.position) / elapsed : NaN };
  });
  let end = intervals.length - 1;
  while (end >= 0 && !(intervals[end].speed > .005)) end--;
  if (end < 0) return null;
  let first = end;
  while (first >= 0 && intervals[first].start.time > lastImpact && intervals[first].speed > .005 && intervals[first].speed <= .35) first--;
  const slow = intervals.slice(first + 1, end + 1);
  if (slow.length < 3) return null;
  const start = slow[0].start, finish = slow.at(-1)!.end;
  const points = [start.ball!.position, ...slow.map(s => s.end.ball!.position)];
  const length = distance(points[0], points[1]);
  if (!length) return null;
  const direction = { x: (points[1].x - points[0].x) / length, y: (points[1].y - points[0].y) / length };
  const delta = { x: points.at(-1)!.x - points[0].x, y: points.at(-1)!.y - points[0].y };
  const along = delta.x * direction.x + delta.y * direction.y;
  const reference = { x: points[0].x + along * direction.x, y: points[0].y + along * direction.y };
  return { points, start, finish, intervals: slow, elapsed: finish.time - start.time, reference,
    sideways: delta.x * -direction.y + delta.y * direction.x, nap };
}
