import { TABLE } from './constants';
import { POCKET_GEOMETRY } from './table-geometry';
import { clamp, distance, dot, normalize, segmentDistance, subtract } from './math';
import { simulateShot } from './physics';
import { hasProvenNextShot } from './objectives';
import { generateScenario } from './scenarios';
import type { BallFinishOptions, FinishOption, PreparedRound, Scenario, ShotPlan, Simulation, Vec2 } from './types';

interface Route { pocketId: number; angle: number; speed: number; difficulty: number }
interface FeasiblePlan { plan: ShotPlan; simulation: Simulation }
export const MIN_FINISH_SEPARATION = 0.12;

function routesFor(scenario: Scenario, ballId: number): Route[] {
  const cue = scenario.balls.find(ball => ball.id === 0)!;
  const object = scenario.balls.find(ball => ball.id === ballId)!;
  const routes: Route[] = [];
  for (const pocket of POCKET_GEOMETRY) {
    // Oblique entry must continue across the shelf into the recessed well.
    // A ray through the mouth midpoint alone can run into the far facing.
    const direction = normalize(subtract(pocket.center, object.position));
    const ghost = { x: object.position.x - direction.x * TABLE.ballDiameter, y: object.position.y - direction.y * TABLE.ballDiameter };
    const aim = normalize(subtract(ghost, cue.position));
    const cut = dot(direction, aim);
    if (cut < 0.17) continue;
    const others = scenario.balls.filter(ball => ball.id !== 0 && ball.id !== ballId);
    if (others.some(ball => segmentDistance(ball.position, cue.position, ghost) < TABLE.ballDiameter * 1.025 || segmentDistance(ball.position, object.position, pocket.center) < TABLE.ballDiameter * 1.025)) continue;
    const objectDistance = distance(object.position, pocket.center);
    const cueDistance = distance(cue.position, ghost);
    const speed = clamp(Math.sqrt(2 * TABLE.rollingFriction * 9.80665 * (objectDistance + 0.13)) / (0.71 * cut) + cueDistance * 0.2, 0.65, 2.8);
    routes.push({ pocketId: pocket.id, angle: Math.atan2(aim.y, aim.x), speed, difficulty: cueDistance * 0.15 + objectDistance * 0.18 + (1 - cut) * 0.8 });
  }
  return routes.sort((a, b) => a.difficulty - b.difficulty).slice(0, 2);
}

function scenarioFingerprint(scenario: Scenario): string {
  let hash = 2166136261;
  for (const char of JSON.stringify([scenario.level, scenario.seed, scenario.balls, scenario.objective])) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
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

function chooseTriple(plans: FeasiblePlan[], qualifies: (plan: FeasiblePlan) => boolean): [FeasiblePlan, FeasiblePlan, FeasiblePlan] | null {
  let chosen: [FeasiblePlan, FeasiblePlan, FeasiblePlan] | null = null;
  let bestCost = Infinity;
  for (let a = 0; a < plans.length - 2; a++) {
    for (let b = a + 1; b < plans.length - 1; b++) {
      if (!pairIsDistinct(plans[a], plans[b])) continue;
      for (let c = b + 1; c < plans.length; c++) {
        if (!pairIsDistinct(plans[a], plans[c]) || !pairIsDistinct(plans[b], plans[c])) continue;
        const triple: [FeasiblePlan, FeasiblePlan, FeasiblePlan] = [plans[a], plans[b], plans[c]];
        if (!triple.some(qualifies)) continue;
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

function prepareBall(scenario: Scenario, ballId: number): { ball: BallFinishOptions; target?: Vec2 } | null {
  if (!scenario.balls.some(ball => ball.id === ballId)) return null;
  const feasible: FeasiblePlan[] = [];
  const qualified = new Map<FeasiblePlan, boolean>();
  const qualifies = (entry: FeasiblePlan): boolean => {
    if (!scenario.objective) return true;
    const cached = qualified.get(entry);
    if (cached !== undefined) return cached;
    const objective = scenario.objective;
    const result = (!objective.target || distance(entry.simulation.cueEnd, objective.target) <= objective.radius)
      && hasProvenNextShot(scenario, entry.simulation);
    qualified.set(entry, result);
    return result;
  };
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
    triple = chooseTriple(feasible, qualifies);
    if (triple) break; // Prefer three strokes to the same pocket when possible.
  }
  if (!triple) return null;
  const target = scenario.objective ? { ...(scenario.objective.target ?? triple.find(qualifies)!.simulation.cueEnd) } : undefined;
  // Labels are fixed by stroke strength, never by score or success probability.
  triple.sort((a, b) => a.plan.speed - b.plan.speed || a.plan.topSpin - b.plan.topSpin);
  const fingerprint = scenarioFingerprint(scenario);
  const options = triple.map((entry, index): FinishOption => {
    const label = (['A', 'B', 'C'] as const)[index];
    const id = `${fingerprint}-ball-${ballId}-${label}`;
    const stroke = entry.plan.topSpin < -0.1 ? 'draw' : entry.plan.topSpin > 0.1 ? 'follow' : 'center';
    return { id, label, plan: { ...entry.plan, id, label: `Ball ${ballId} · ${label} · ${stroke}` } };
  }) as [FinishOption, FinishOption, FinishOption];
  return { ball: { ballId, options }, target };
}

function prepareLayout(scenario: Scenario): PreparedRound {
  if (scenario.objective) {
    const prepared = prepareBall(scenario, scenario.objective.ballId);
    return prepared
      ? { scenario: { ...scenario, objective: { ...scenario.objective, target: prepared.target } }, balls: [prepared.ball] }
      : { scenario, balls: [] };
  }
  return { scenario, balls: scenario.balls.filter(ball => ball.id !== 0).flatMap(ball => {
    const prepared = prepareBall(scenario, ball.id);
    return prepared ? [prepared.ball] : [];
  }) };
}

/** Search is bounded: at most 30 nominal strokes per object ball plus next-pot
 * checks, then three replacements of the same authored lesson. Authored lessons
 * and fixed position puzzles never fall back to an unrelated easier layout. */
export function prepareRound(scenario: Scenario): PreparedRound {
  if (!scenario.balls.some(ball => ball.id === 0)) throw new Error('The table needs a cue ball.');
  const objective = scenario.objective;
  if (objective && (!Number.isInteger(objective.ballId) || !Number.isInteger(objective.nextBallId)
    || objective.ballId <= 0 || objective.nextBallId <= 0 || objective.ballId === objective.nextBallId
    || !Number.isFinite(objective.radius) || objective.radius <= 0
    || !Number.isFinite(objective.maxCutAngle) || objective.maxCutAngle < 0 || objective.maxCutAngle >= 90
    || (objective.target && (![objective.target.x, objective.target.y].every(Number.isFinite)
      || objective.target.x < TABLE.ballRadius || objective.target.x > TABLE.length - TABLE.ballRadius
      || objective.target.y < TABLE.ballRadius || objective.target.y > TABLE.width - TABLE.ballRadius)))) {
    throw new Error('The position lesson needs distinct object balls, a positive landing radius, a cut limit below 90°, and a zone on the table.');
  }
  if (objective && (!scenario.balls.some(ball => ball.id === objective.ballId) || !scenario.balls.some(ball => ball.id === objective.nextBallId))) {
    throw new Error('The position lesson needs both its first object ball and its reserved next ball on the table.');
  }
  const attempts = objective && !scenario.curriculum ? 1 : 4;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const generated = attempt === 0 ? scenario : generateScenario(scenario.level, (scenario.seed + Math.imul(attempt, 0x9E3779B1)) >>> 0);
    // Regeneration changes only the layout; a lesson's objective is never lost.
    const layout = { ...scenario, seed: generated.seed, balls: generated.balls };
    const prepared = prepareLayout(layout);
    if (prepared.balls.length) return prepared;
  }
  if (scenario.curriculum || objective) throw new Error('No feasible three-finish layout could be prepared for this lesson and its objective.');
  const openLayout: Scenario = { ...scenario, seed: 72350, balls: generateScenario(1, 72350).balls };
  const prepared = prepareLayout(openLayout);
  if (!prepared.balls.length) throw new Error('No feasible three-finish layout could be prepared.');
  return prepared;
}
