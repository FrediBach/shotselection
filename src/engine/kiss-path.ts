import { splitPathsReplay } from './split-paths';
import type { Scenario, Simulation, Vec2 } from './types';

/** Follow ball 1 into and out of the recorded 1–2 contact. */
export function kissPathReplay(source: Scenario, simulation: Simulation) {
  const split = splitPathsReplay(source, simulation);
  if (!split) return null;
  const start = source.balls.find(ball => ball.id === 1);
  if (!start) return null;
  const incoming: Vec2[] = [{ ...start.position }];
  for (const frame of simulation.frames) {
    if (frame.time >= split.transfer.time) break;
    const ball = frame.balls.find(ball => ball.id === 1);
    if (!ball || ball.pocketed) return null;
    const last = incoming.at(-1)!;
    if (last.x !== ball.position.x || last.y !== ball.position.y) incoming.push({ ...ball.position });
  }
  const outgoing = split.paths[0];
  const contact = outgoing.points[0], last = incoming.at(-1)!;
  if (last.x !== contact.x || last.y !== contact.y) incoming.push({ ...contact });
  if (incoming.length < 2) return null;
  return { contact: split.transfer, incoming, outgoing: outgoing.points, potted: outgoing.potted };
}
