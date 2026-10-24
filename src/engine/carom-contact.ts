import { contactChainReplay } from './contact-chain';
import type { Scenario, Simulation, Vec2 } from './types';

/** The cue's measured journey between its two scoring contacts. */
export function caromContactReplay(source: Scenario, simulation: Simulation) {
  const chain = contactChainReplay(source, simulation);
  if (!chain.complete || chain.steps.length !== 2 || chain.steps[0].pair.join() !== '0,1' || chain.steps[1].pair.join() !== '0,2') return null;
  const [first, second] = chain.steps.map(step => step.event);
  const start = first.balls?.find(ball => ball.id === 0), end = second.balls?.find(ball => ball.id === 0);
  if (!start || !end || start.pocketed || end.pocketed || !simulation.frames.length) return null;
  const points: Vec2[] = [{ ...start.position }];
  for (const frame of simulation.frames) {
    if (frame.time <= first.time || frame.time >= second.time) continue;
    const cue = frame.balls.find(ball => ball.id === 0);
    if (!cue || cue.pocketed) return null;
    const last = points.at(-1)!;
    if (last.x !== cue.position.x || last.y !== cue.position.y) points.push({ ...cue.position });
  }
  const last = points.at(-1)!;
  if (last.x !== end.position.x || last.y !== end.position.y) points.push({ ...end.position });
  return { first, second, points };
}
