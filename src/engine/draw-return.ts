import { contactChainReplay } from './contact-chain';
import type { Scenario, Simulation } from './types';

/** Locate the furthest recorded cue position along its incoming direction.
 * Replay frames bracket the turn; this is not an interpolated zero-speed point. */
export function drawReturnReplay(source: Scenario, simulation: Simulation) {
  const chain = contactChainReplay(source, simulation);
  if (!chain.complete || chain.steps.map(s => s.pair.join()).join(';') !== '0,1;0,2' || !simulation.frames.length) return null;
  const [first, second] = chain.steps.map(s => s.event);
  if (!first.balls || !second.balls || second.time <= first.time) return null;
  const velocity = first.incoming[first.ballIds.indexOf(0)], magnitude = Math.hypot(velocity.x, velocity.y);
  if (!magnitude) return null;
  const direction = { x: velocity.x / magnitude, y: velocity.y / magnitude };
  const frames = [{ time: first.time, balls: first.balls }, ...simulation.frames.filter(f => f.time > first.time && f.time < second.time), { time: second.time, balls: second.balls }];
  const samples = frames.map(frame => {
    const cue = frame.balls.find(b => b.id === 0);
    return cue && !cue.pocketed ? { ...frame, position: cue.position, progress: cue.position.x * direction.x + cue.position.y * direction.y } : null;
  });
  if (samples.some(s => !s)) return null;
  const valid = samples.filter(s => s !== null);
  const turnIndex = valid.reduce((best, sample, i) => sample.progress > valid[best].progress ? i : best, 0);
  if (turnIndex === valid.length - 1 || valid[turnIndex].progress - valid.at(-1)!.progress < .05) return null;
  const incoming = second.incoming[second.ballIds.indexOf(0)];
  const returnSpeed = Math.hypot(incoming.x, incoming.y);
  if (!Number.isFinite(returnSpeed) || returnSpeed <= 0 || incoming.x * direction.x + incoming.y * direction.y >= 0) return null;
  return { first, second, samples: valid, turnIndex, turn: valid[turnIndex],
    bracket: [valid[Math.max(0, turnIndex - 1)].time, valid[turnIndex + 1].time], returnSpeed };
}
