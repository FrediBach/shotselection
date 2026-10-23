import { Body } from 'cannon-es';
import { TABLE } from './constants';
import { clamp, distance, dot, normalize, segmentDistance, subtract } from './math';
import { applyCloth, resolveRails } from './physics';
import { cueStroke } from './table-conditions';
import { CUSHIONS, isPocketed, POCKET_GEOMETRY } from './table-geometry';
import type { CushionSide } from './table-geometry';
import type { Scenario, ShotPlan, Vec2 } from './types';

export interface BankRoute {
  pocketId: number;
  angle: number;
  ghost: Vec2;
  direction: Vec2;
  sides: CushionSide[];
  length: number;
  difficulty: number;
}

const SIDES: CushionSide[] = ['top', 'bottom', 'left', 'right'];
const edge = (side: CushionSide) => side === 'top' || side === 'left' ? TABLE.ballRadius
  : side === 'bottom' ? TABLE.width - TABLE.ballRadius : TABLE.length - TABLE.ballRadius;
const horizontal = (side: CushionSide) => side === 'top' || side === 'bottom';

function mirror(point: Vec2, side: CushionSide): Vec2 {
  return horizontal(side) ? { x: point.x, y: 2 * edge(side) - point.y } : { x: 2 * edge(side) - point.x, y: point.y };
}

function sequences(count: number, prefix: CushionSide[] = []): CushionSide[][] {
  if (prefix.length === count) return [prefix];
  return SIDES.filter(side => side !== prefix.at(-1)).flatMap(side => sequences(count, [...prefix, side]));
}

/** Mirror-table seeds only. Final strokes are calibrated to cloth friction,
 * cushion restitution and spin, then checked in the complete simulator. */
export function bankRoutesFor(scenario: Scenario, ballId: number): BankRoute[] {
  const cue = scenario.balls.find(ball => ball.id === 0);
  const object = scenario.balls.find(ball => ball.id === ballId);
  if (!cue || !object || !scenario.bank) return [];
  const routes: BankRoute[] = [];
  const others = scenario.balls.filter(ball => ball.id !== 0 && ball.id !== ballId);
  for (const pocket of POCKET_GEOMETRY) {
    if (others.some(ball => segmentDistance(ball.position, object.position, pocket.center) < TABLE.ballDiameter * 1.025)) continue;
    const direction = normalize(subtract(pocket.center, object.position));
    const ghost = { x: object.position.x - direction.x * TABLE.ballDiameter, y: object.position.y - direction.y * TABLE.ballDiameter };
    for (const sides of sequences(scenario.bank.minCushions)) {
      let reflected = ghost;
      for (const side of [...sides].reverse()) reflected = mirror(reflected, side);
      let point = cue.position;
      let ray = normalize(subtract(reflected, point));
      const angle = Math.atan2(ray.y, ray.x);
      let length = 0;
      let valid = true;
      for (const side of sides) {
        const component = horizontal(side) ? ray.y : ray.x;
        const from = horizontal(side) ? point.y : point.x;
        const t = (edge(side) - from) / component;
        if (t <= 0 || !Number.isFinite(t)) { valid = false; break; }
        const hit = { x: point.x + ray.x * t, y: point.y + ray.y * t };
        const along = horizontal(side) ? hit.x - TABLE.length / 2 : hit.y - TABLE.width / 2;
        if (!CUSHIONS.some(cushion => cushion.side === side && along > cushion.start + 0.025 && along < cushion.end - 0.025)) { valid = false; break; }
        if (hit.x < TABLE.ballRadius - 1e-6 || hit.x > TABLE.length - TABLE.ballRadius + 1e-6
          || hit.y < TABLE.ballRadius - 1e-6 || hit.y > TABLE.width - TABLE.ballRadius + 1e-6) { valid = false; break; }
        length += t;
        point = hit;
        ray = horizontal(side) ? { x: ray.x, y: -ray.y } : { x: -ray.x, y: ray.y };
      }
      const cut = dot(direction, ray);
      if (!valid || cut < 0.3 || dot(subtract(ghost, point), ray) < 0) continue;
      length += distance(point, ghost);
      routes.push({ pocketId: pocket.id, angle, ghost, direction, sides, length,
        difficulty: length * 0.12 + distance(object.position, pocket.center) * 0.4 + (1 - cut) * 1.3 });
    }
  }
  return routes.sort((a, b) => a.difficulty - b.difficulty).slice(0, 12);
}

interface Approach { error: number; gap: number; cut: number; blocked: boolean; sides: CushionSide[] }

/** Fast cue-only integration uses exactly the full simulator's cloth and rail
 * impulses. Object-ball collisions are checked by the final full simulation. */
function approach(scenario: Scenario, start: Vec2, ballId: number, route: BankRoute, angle: number, speed: number, topSpin: number): Approach {
  const body = new Body({ mass: TABLE.ballMass, linearDamping: 0, angularDamping: 0 });
  const stroke = cueStroke({ angle, speed, topSpin, sideSpin: 0 }, scenario.conditions);
  body.position.set(start.x, start.y, 0);
  body.velocity.set(Math.cos(stroke.angle) * stroke.speed, Math.sin(stroke.angle) * stroke.speed, 0);
  body.angularVelocity.set(-Math.sin(stroke.angle) * stroke.speed / TABLE.ballRadius * stroke.topSpin, Math.cos(stroke.angle) * stroke.speed / TABLE.ballRadius * stroke.topSpin, stroke.sideSpin);
  const others = scenario.balls.filter(ball => ball.id !== 0 && ball.id !== ballId);
  let blocked = false;
  let gap = Infinity;
  let error = Infinity;
  let cut = 0;
  const sides: CushionSide[] = [];
  let lastBank = -Infinity;
  for (let step = 0; step < 3600; step++) {
    const previous = { x: body.position.x, y: body.position.y };
    applyCloth(body, TABLE.step, scenario.conditions);
    body.position.x += body.velocity.x * TABLE.step;
    body.position.y += body.velocity.y * TABLE.step;
    const impact = resolveRails(body, scenario.conditions);
    if (impact > 0.035 && step * TABLE.step - lastBank >= 0.045) {
      lastBank = step * TABLE.step;
      const distances = SIDES.map(side => Math.abs((horizontal(side) ? body.position.y : body.position.x) - edge(side)));
      sides.push(SIDES[distances.indexOf(Math.min(...distances))]);
      if (sides.length > route.sides.length) break;
    }
    if (isPocketed(body.position)) break;
    if (others.some(ball => segmentDistance(ball.position, previous, body.position) < TABLE.ballDiameter * 1.005)) blocked = true;
    if (sides.length === route.sides.length) {
      const candidateGap = segmentDistance(route.ghost, previous, body.position);
      if (candidateGap < gap) {
        gap = candidateGap;
        const ray = normalize({ x: body.velocity.x, y: body.velocity.y });
        error = (route.ghost.x - body.position.x) * ray.y - (route.ghost.y - body.position.y) * ray.x;
        cut = dot(route.direction, ray);
      } else if (gap < 0.03) break;
    }
    if (Math.hypot(body.velocity.x, body.velocity.y) < 0.005) break;
  }
  return { gap, error, cut, blocked, sides };
}

/** Bounded Newton shooting corrects ideal reflected angles for actual cushions.
 * Every speed/spin combination is independently aimed; no endpoint is invented. */
export function bankPlanForStroke(scenario: Scenario, route: BankRoute, speed: number, topSpin: number): ShotPlan | null {
  const cue = scenario.balls.find(ball => ball.id === 0);
  const bank = scenario.bank;
  if (!cue || !bank || !scenario.balls.some(ball => ball.id === bank.ballId)) return null;
  let angle = route.angle - (scenario.conditions?.cue?.angleBias ?? 0);
  let result: Approach | undefined;
  for (let iteration = 0; iteration < 9; iteration++) {
    result = approach(scenario, cue.position, bank.ballId, route, angle, speed, topSpin);
    if (!Number.isFinite(result.error)) return null;
    if (result.gap < 0.0003) break;
    const delta = 0.0007;
    // A symmetric derivative preserves mirrored-table behavior. One-sided
    // differences can diverge on one reflection at discrete cushion steps.
    const before = approach(scenario, cue.position, bank.ballId, route, angle - delta, speed, topSpin);
    const after = approach(scenario, cue.position, bank.ballId, route, angle + delta, speed, topSpin);
    const derivative = (after.error - before.error) / (2 * delta);
    if (!Number.isFinite(derivative) || Math.abs(derivative) < 0.05) return null;
    angle -= clamp(result.error / derivative, -0.12, 0.12);
  }
  if (!result || result.gap > 0.003 || result.cut < 0.17 || result.blocked
    || result.sides.some((side, index) => side !== route.sides[index])) return null;
  return { id: '', ballId: bank.ballId, pocketId: route.pocketId, angle, speed, topSpin, sideSpin: 0, target: { x: 0, y: 0 }, label: '' };
}
