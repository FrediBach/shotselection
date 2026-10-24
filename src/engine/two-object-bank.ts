import { TABLE } from './constants';
import type { Scenario, Simulation, Vec2 } from './types';

export function twoObjectBankReplay(source: Scenario, simulation: Simulation) {
  const ballId = source.trick?.potBallId;
  if (source.trick?.minObjectCushions !== 2 || ballId === undefined || !simulation.frames.length) return null;
  const contact = simulation.contactEvents?.find(e => e.ballIds.includes(0) && e.ballIds.includes(ballId));
  const rebounds = simulation.objectRebounds?.filter(e => e.ballId === ballId);
  if (!contact?.balls || rebounds?.length !== 2 || rebounds[0].time <= contact.time || rebounds[1].time <= rebounds[0].time) return null;
  const sides = rebounds.map(e => Math.min(Math.abs(e.position.x-TABLE.ballRadius),Math.abs(e.position.x-(TABLE.length-TABLE.ballRadius))) < .002 ? 'short' : Math.min(Math.abs(e.position.y-TABLE.ballRadius),Math.abs(e.position.y-(TABLE.width-TABLE.ballRadius))) < .002 ? 'long' : null);
  if (sides.some(side => !side) || sides[0] === sides[1]) return null;
  const start = contact.balls.find(b => b.id === ballId);
  if (!start || start.pocketed) return null;
  const boundaries = [{time:contact.time,position:start.position}, ...rebounds];
  const segments: Vec2[][] = boundaries.map((point,i) => {
    const end = boundaries[i+1], path = [{...point.position}];
    for (const frame of simulation.frames) {
      if (frame.time <= point.time || (end && frame.time >= end.time)) continue;
      const ball = frame.balls.find(b => b.id === ballId);
      if (!ball) return [];
      path.push({...ball.position});
      if (ball.pocketed) break;
    }
    if (end) path.push({...end.position});
    return path;
  });
  if (segments.some(path => path.length < 2)) return null;
  const speeds = rebounds.map(e => ({before:Math.hypot(e.incoming.x,e.incoming.y),after:Math.hypot(e.outgoing.x,e.outgoing.y)}));
  return {contact,rebounds,segments,speeds,sides};
}
