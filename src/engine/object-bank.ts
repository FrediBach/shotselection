import type { Scenario, Simulation, Vec2 } from './types';

export function objectBankReplay(source: Scenario, simulation: Simulation) {
  const ballId = source.trick?.potBallId;
  if (!source.trick?.minObjectCushions || ballId === undefined || !simulation.frames.length) return null;
  const contact = simulation.contactEvents?.find(e => e.ballIds.includes(0) && e.ballIds.includes(ballId));
  const rebound = simulation.objectRebounds?.find(e => e.ballId === ballId && contact && e.time > contact.time);
  const start = contact?.balls?.find(b => b.id === ballId);
  if (!contact || !rebound || !start || start.pocketed) return null;
  const before: Vec2[] = [{ ...start.position }], after: Vec2[] = [{ ...rebound.position }];
  for (const frame of simulation.frames) {
    if (frame.time <= contact.time) continue;
    const ball = frame.balls.find(b => b.id === ballId);
    if (!ball) return null;
    if (frame.time < rebound.time) before.push({ ...ball.position });
    else if (frame.time > rebound.time) after.push({ ...ball.position });
    if (ball.pocketed) break;
  }
  before.push({ ...rebound.position });
  if (after.length < 2) return null;
  return { contact, rebound, before, after, ballId };
}
