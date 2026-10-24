import { contactChainReplay } from './contact-chain';
import type { Scenario, Simulation, Vec2 } from './types';

/** Traces join recorded post-transfer frames, stopping at each ball's actual
 * capture position. They are sampled trajectories, not projected contact rays. */
export function splitPathsReplay(source: Scenario, simulation: Simulation) {
  const chain = contactChainReplay(source, simulation);
  const transfer = chain.steps.find(step => step.pair.includes(1) && step.pair.includes(2))?.event;
  if (!chain.complete || !transfer?.balls || !simulation.frames.length) return null;
  const paths = [1, 2].map(ballId => {
    const start = transfer.balls!.find(ball => ball.id === ballId);
    if (!start || start.pocketed) return null;
    const points: Vec2[] = [{ ...start.position }];
    for (const frame of simulation.frames) {
      if (frame.time <= transfer.time) continue;
      const ball = frame.balls.find(ball => ball.id === ballId);
      if (!ball) return null;
      const last = points.at(-1)!;
      if (last.x !== ball.position.x || last.y !== ball.position.y) points.push({ ...ball.position });
      if (ball.pocketed) break;
    }
    if (points.length < 2) return null;
    return { ballId, points, potted: simulation.potted.includes(ballId) };
  });
  if (!paths[0] || !paths[1]) return null;
  return { transfer, paths: [paths[0], paths[1]] };
}
