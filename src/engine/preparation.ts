import { POCKETS, TABLE } from './constants';
import { clamp, distance, dot, normalize, segmentDistance, subtract } from './math';
import { simulateShot } from './physics';
import { generateScenario } from './scenarios';
import type { BallFinishOptions, FinishOption, PreparedRound, Scenario, ShotPlan, Simulation } from './types';

interface Route { pocketId: number; angle: number; speed: number; difficulty: number }
interface FeasiblePlan { plan: ShotPlan; simulation: Simulation }
export const MIN_FINISH_SEPARATION = 0.12;

function routesFor(scenario: Scenario, ballId: number): Route[] {
  const cue = scenario.balls.find(ball => ball.id === 0)!;
  const object = scenario.balls.find(ball => ball.id === ballId)!;
  const routes: Route[] = [];
  for (const pocket of POCKETS) {
    const direction = normalize(subtract(pocket.position, object.position));
    const ghost = { x: object.position.x - direction.x * TABLE.ballDiameter, y: object.position.y - direction.y * TABLE.ballDiameter };
    const aim = normalize(subtract(ghost, cue.position));
    const cut = dot(direction, aim);
    if (cut < 0.17) continue;
    const others = scenario.balls.filter(ball => ball.id !== 0 && ball.id !== ballId);
    if (others.some(ball => segmentDistance(ball.position, cue.position, ghost) < TABLE.ballDiameter * 1.025 || segmentDistance(ball.position, object.position, pocket.position) < TABLE.ballDiameter * 1.025)) continue;
    const objectDistance = distance(object.position, pocket.position);
    const cueDistance = distance(cue.position, ghost);
    const speed = clamp(Math.sqrt(2 * TABLE.rollingFriction * 9.80665 * (objectDistance + 0.13)) / (0.71 * cut) + cueDistance * 0.2, 0.65, 2.8);
    routes.push({ pocketId: pocket.id, angle: Math.atan2(aim.y, aim.x), speed, difficulty: cueDistance * 0.15 + objectDistance * 0.18 + (1 - cut) * 0.8 });
  }
  return routes.sort((a, b) => a.difficulty - b.difficulty).slice(0, 2);
}

function scenarioFingerprint(scenario: Scenario): string {
  let hash = 2166136261;
  for (const char of JSON.stringify([scenario.level, scenario.seed, scenario.balls])) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return (hash >>> 0).toString(36);
}

function isFeasible(simulation: Simulation, ballId: number): boolean {
  const p = simulation.cueEnd;
  return simulation.stopped && !simulation.scratch && simulation.firstContact === ballId && simulation.potted.includes(ballId)
    && p.x >= TABLE.ballRadius && p.x <= TABLE.length - TABLE.ballRadius
    && p.y >= TABLE.ballRadius && p.y <= TABLE.width - TABLE.ballRadius;
}

/** Distinct endpoints alone are insufficient: every pair also changes strength
 * and longitudinal spin, so the ensembles describe different physical strokes. */
function pairIsDistinct(a: FeasiblePlan, b: FeasiblePlan): boolean {
  return Math.abs(a.plan.speed - b.plan.speed) >= 0.12
    && Math.abs(a.plan.topSpin - b.plan.topSpin) >= 0.35
    && distance(a.simulation.cueEnd, b.simulation.cueEnd) >= MIN_FINISH_SEPARATION;
}

function chooseTriple(plans: FeasiblePlan[]): [FeasiblePlan, FeasiblePlan, FeasiblePlan] | null {
  let chosen: [FeasiblePlan, FeasiblePlan, FeasiblePlan] | null = null;
  let bestCost = Infinity;
  for (let a = 0; a < plans.length - 2; a++) {
    for (let b = a + 1; b < plans.length - 1; b++) {
      if (!pairIsDistinct(plans[a], plans[b])) continue;
      for (let c = b + 1; c < plans.length; c++) {
        if (!pairIsDistinct(plans[a], plans[c]) || !pairIsDistinct(plans[b], plans[c])) continue;
        const triple: [FeasiblePlan, FeasiblePlan, FeasiblePlan] = [plans[a], plans[b], plans[c]];
        // Prefer comfortable strokes and visually separate endpoints. This is
        // geometry/nominal feasibility only, never a hidden ensemble ranking.
        const separation = Math.min(distance(plans[a].simulation.cueEnd, plans[b].simulation.cueEnd), distance(plans[a].simulation.cueEnd, plans[c].simulation.cueEnd), distance(plans[b].simulation.cueEnd, plans[c].simulation.cueEnd));
        const cost = triple.reduce((sum, entry) => sum + entry.plan.speed, 0) - Math.min(separation, 0.35) * 2;
        if (cost < bestCost) { chosen = triple; bestCost = cost; }
      }
    }
  }
  return chosen;
}

function prepareBall(scenario: Scenario, ballId: number): BallFinishOptions | null {
  const feasible: FeasiblePlan[] = [];
  let triple: [FeasiblePlan, FeasiblePlan, FeasiblePlan] | null = null;
  for (const route of routesFor(scenario, ballId)) {
    for (const multiplier of [0.95, 1.2, 1.5, 1.85, 2.3]) {
      for (const topSpin of [-1.1, 0, 1.05]) {
        const plan: ShotPlan = { id: '', ballId, pocketId: route.pocketId, angle: route.angle, speed: Math.min(3.6, route.speed * multiplier), topSpin, sideSpin: 0, target: { x: 0, y: 0 }, label: '' };
        const simulation = simulateShot(scenario, plan, { record: false });
        if (isFeasible(simulation, ballId)) {
          plan.target = { ...simulation.cueEnd };
          feasible.push({ plan, simulation });
        }
      }
    }
    triple = chooseTriple(feasible);
    if (triple) break; // Prefer three strokes to the same pocket when possible.
  }
  if (!triple) return null;
  // Labels are fixed by stroke strength, never by score or success probability.
  triple.sort((a, b) => a.plan.speed - b.plan.speed || a.plan.topSpin - b.plan.topSpin);
  const fingerprint = scenarioFingerprint(scenario);
  const options = triple.map((entry, index): FinishOption => {
    const label = (['A', 'B', 'C'] as const)[index];
    const id = `${fingerprint}-ball-${ballId}-${label}`;
    const stroke = entry.plan.topSpin < -0.1 ? 'draw' : entry.plan.topSpin > 0.1 ? 'follow' : 'center';
    return { id, label, plan: { ...entry.plan, id, label: `Ball ${ballId} · ${label} · ${stroke}` } };
  }) as [FinishOption, FinishOption, FinishOption];
  return { ballId, options };
}

function prepareLayout(scenario: Scenario): PreparedRound {
  return { scenario, balls: scenario.balls.filter(ball => ball.id !== 0).map(ball => prepareBall(scenario, ball.id)).filter((ball): ball is BallFinishOptions => ball !== null) };
}

/** Search is bounded: at most 30 nominal strokes per object ball, three seeded
 * replacement layouts, then a known open layout whose options are still tested.
 * Unsupported balls stay visible; no impossible finishes are fabricated. */
export function prepareRound(scenario: Scenario): PreparedRound {
  if (!scenario.balls.some(ball => ball.id === 0)) throw new Error('The table needs a cue ball.');
  for (let attempt = 0; attempt < 4; attempt++) {
    const layout = attempt === 0 ? scenario : generateScenario(scenario.level, (scenario.seed + Math.imul(attempt, 0x9E3779B1)) >>> 0);
    const prepared = prepareLayout(layout);
    if (prepared.balls.length) return prepared;
  }
  const openLayout = { ...generateScenario(1, 72350), level: scenario.level, title: scenario.title, description: scenario.description };
  const prepared = prepareLayout(openLayout);
  if (!prepared.balls.length) throw new Error('No feasible three-finish layout could be prepared.');
  return prepared;
}
