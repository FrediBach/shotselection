import { POCKETS, TABLE } from './constants';
import { clampTarget, distance, dot, normalize, seededRandom, segmentDistance, subtract } from './math';
import type { Ball, Scenario, Vec2 } from './types';

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
    description: safeLevel < 3 ? 'Pot any object ball and leave the cue ball in your chosen position.' : 'Read the traffic. Choose a pot and a cue-ball finish that tolerate a small mistake.',
    balls,
  };
}

/** A quick natural-roll position based on cut geometry. The ensemble still has
 * to evaluate it; this preview does not silently run or reveal the shot ranking. */
export function recommendedTarget(scenario: Scenario, ballId = 1): Vec2 {
  const ball = scenario.balls.find(candidate => candidate.id === ballId);
  const cue = scenario.balls.find(candidate => candidate.id === 0)!;
  if (!ball) return { x: TABLE.length / 2, y: TABLE.width / 2 };
  const others = scenario.balls.filter(candidate => candidate.id !== 0 && candidate.id !== ballId);
  const routes = POCKETS.map(pocket => {
    const outgoing = normalize(subtract(pocket.position, ball.position));
    const ghost = { x: ball.position.x - outgoing.x * TABLE.ballDiameter, y: ball.position.y - outgoing.y * TABLE.ballDiameter };
    const incoming = normalize(subtract(ghost, cue.position));
    const cut = dot(outgoing, incoming);
    const blocked = others.some(other => segmentDistance(other.position, cue.position, ghost) < TABLE.ballDiameter || segmentDistance(other.position, ball.position, pocket.position) < TABLE.ballDiameter);
    const difficulty = distance(cue.position, ghost) * 0.15 + distance(ball.position, pocket.position) * 0.18 + (1 - cut) * 0.8;
    return { outgoing, incoming, cut, blocked, difficulty };
  }).filter(route => route.cut > 0.17 && !route.blocked).sort((a, b) => a.difficulty - b.difficulty);
  const route = routes[0];
  if (!route) return clampTarget(ball.position);
  const cross = route.incoming.x * route.outgoing.y - route.incoming.y * route.outgoing.x;
  const deflection = Math.sign(cross) * Math.min(Math.PI / 6, Math.acos(Math.min(1, route.cut)) * 1.2);
  const angle = Math.atan2(route.incoming.y, route.incoming.x) - deflection;
  const travel = 0.16 + 0.45 * Math.sqrt(1 - route.cut * route.cut);
  return clampTarget({ x: ball.position.x + Math.cos(angle) * travel, y: ball.position.y + Math.sin(angle) * travel });
}
