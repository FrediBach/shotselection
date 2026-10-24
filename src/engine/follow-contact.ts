import { contactChainReplay } from './contact-chain';
import type { Scenario, Simulation } from './types';

/** Keep the repeated cue/1 impacts separate, with the plant transfer between. */
export function followContactReplay(source: Scenario, simulation: Simulation) {
  const chain = contactChainReplay(source, simulation);
  if (!chain.complete || chain.steps.map(s => s.pair.join()).join(';') !== '0,1;1,2;0,1') return null;
  const [first, transfer, repeat] = chain.steps.map(s => s.event);
  if (repeat.time <= first.time || transfer.time < first.time || transfer.time > repeat.time) return null;
  const cueIndex = repeat.ballIds.indexOf(0), objectIndex = repeat.ballIds.indexOf(1);
  if (cueIndex < 0 || objectIndex < 0) return null;
  const cue = repeat.positions[cueIndex], object = repeat.positions[objectIndex];
  const dx = object.x - cue.x, dy = object.y - cue.y, length = Math.hypot(dx, dy);
  if (!length) return null;
  const velocity = repeat.incoming[cueIndex], otherVelocity = repeat.incoming[objectIndex];
  const closingSpeed = ((velocity.x - otherVelocity.x) * dx + (velocity.y - otherVelocity.y) * dy) / length;
  if (!Number.isFinite(closingSpeed) || closingSpeed <= 0) return null;
  return { first, transfer, repeat, elapsed: repeat.time - first.time, closingSpeed };
}
