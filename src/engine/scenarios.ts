import { TABLE } from './constants';
import { clampTarget, distance, seededRandom } from './math';
import type { Ball, Scenario } from './types';

const titles = ['Find your line', 'A little more angle', 'Think one shot ahead', 'Working around traffic', 'Small margins', 'Thread the needle'];

export function generateScenario(level: number, seed = 71431 + level * 919): Scenario {
  const safeLevel = Math.max(1, Math.floor(level));
  const random = seededRandom(seed);
  const jitter = Math.min(0.11, 0.018 + (safeLevel - 1) * 0.012);
  const base: Ball[] = [
    { id: 0, position: { x: 0.73, y: 0.83 } },
    { id: 1, position: { x: 1.16, y: 0.33 } },
    { id: 2, position: { x: 1.84, y: 0.39 } },
    { id: 3, position: { x: 1.88, y: 0.95 } },
  ];
  const mirrorX = safeLevel > 1 && random() > 0.5;
  const mirrorY = safeLevel > 1 && random() > 0.5;
  const balls = base.map(ball => {
    const x = ball.position.x + (random() - 0.5) * jitter * 2;
    const y = ball.position.y + (random() - 0.5) * jitter * 2;
    return { id: ball.id, position: clampTarget({ x: mirrorX ? TABLE.length - x : x, y: mirrorY ? TABLE.width - y : y }) };
  });
  const blockers = Math.min(5, Math.floor((safeLevel - 1) / 2));
  for (let index = 0; index < blockers; index++) {
    for (let attempt = 0; attempt < 80; attempt++) {
      const position = { x: 0.35 + random() * 1.84, y: 0.2 + random() * 0.87 };
      if (balls.every(ball => distance(ball.position, position) > 0.15)) {
        balls.push({ id: index + 4, position });
        break;
      }
    }
  }
  return {
    level: safeLevel,
    seed,
    title: titles[Math.min(titles.length - 1, safeLevel - 1)],
    description: safeLevel < 3 ? 'Choose an object ball, then pick one of its three cue-ball finishes.' : 'Read the traffic. Pick the ball and finish that best tolerate a small mistake.',
    balls,
  };
}
