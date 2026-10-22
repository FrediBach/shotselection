import { POCKETS, TABLE, positionToleranceForLevel } from './constants';
import { clamp, clampTarget, distance, dot, normalRandom, normalize, seededRandom, segmentDistance, subtract } from './math';
import { simulateShot } from './physics';
import type { AnalyzeOptions, RoundAnalysis, Scenario, Selection, ShotAnalysis, ShotPlan, Simulation, Vec2 } from './types';

interface Route { pocketId: number; angle: number; speed: number; difficulty: number }
const isLegalPot = (simulation: Simulation, ballId: number) => !simulation.scratch && simulation.firstContact === ballId && simulation.potted.includes(ballId);

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
    const cueBlocked = others.some(ball => segmentDistance(ball.position, cue.position, ghost) < TABLE.ballDiameter * 1.025);
    const potBlocked = others.some(ball => segmentDistance(ball.position, object.position, pocket.position) < TABLE.ballDiameter * 1.025);
    if (cueBlocked || potBlocked) continue;
    const objectDistance = distance(object.position, pocket.position);
    const cueDistance = distance(cue.position, ghost);
    // Energy estimate only seeds a numerical search. Every accepted plan is simulated.
    const speed = clamp(Math.sqrt(2 * TABLE.rollingFriction * 9.80665 * (objectDistance + 0.13)) / (0.71 * cut) + cueDistance * 0.2, 0.65, 2.8);
    routes.push({ pocketId: pocket.id, angle: Math.atan2(aim.y, aim.x), speed, difficulty: cueDistance * 0.15 + objectDistance * 0.18 + (1 - cut) * 0.8 });
  }
  return routes.sort((a, b) => a.difficulty - b.difficulty).slice(0, 2);
}

function makePlan(ballId: number, route: Route, speed: number, topSpin: number, target: Vec2): ShotPlan {
  return { id: `ball-${ballId}-pocket-${route.pocketId}`, ballId, pocketId: route.pocketId, target, angle: route.angle, speed, topSpin, sideSpin: 0, label: `Ball ${ballId} · ${POCKETS[route.pocketId].name}` };
}

function findPlan(scenario: Scenario, ballId: number, target?: Vec2): ShotPlan {
  const object = scenario.balls.find(ball => ball.id === ballId)!;
  const cue = scenario.balls.find(ball => ball.id === 0)!;
  const routes = routesFor(scenario, ballId);
  if (routes.length === 0) {
    const route = { pocketId: 1, angle: Math.atan2(object.position.y - cue.position.y, object.position.x - cue.position.x), speed: 1.1, difficulty: 10 };
    return makePlan(ballId, route, 1.1, 0, target ?? object.position);
  }
  let best: { plan: ShotPlan; simulation: Simulation; cost: number } | null = null;
  for (const route of routes) {
    for (const multiplier of [1.02, 1.3, 1.65]) {
      for (const spin of [-0.65, 0, 0.85]) {
        const plan = makePlan(ballId, route, Math.min(3.6, route.speed * multiplier), spin, target ?? object.position);
        const simulation = simulateShot(scenario, plan, { record: false });
        const legal = isLegalPot(simulation, ballId);
        const error = target ? distance(simulation.cueEnd, target) : 0;
        const railMargin = Math.min(simulation.cueEnd.x, TABLE.length - simulation.cueEnd.x, simulation.cueEnd.y, TABLE.width - simulation.cueEnd.y);
        const positionRisk = target ? error * 3 : Math.max(0, 0.15 - railMargin) * 2;
        const cost = (legal ? 0 : 8) + (simulation.scratch ? 5 : 0) + positionRisk + route.difficulty * 0.15 + plan.speed * 0.025 + Math.abs(spin) * 0.015;
        if (!best || cost < best.cost) best = { plan, simulation, cost };
      }
    }
  }
  if (!best) throw new Error('No shot could be planned.');
  // Refine speed and follow/draw around the best numerical solution for a user target.
  if (target) {
    for (const scale of [0.16, 0.065]) {
      const center: { plan: ShotPlan; simulation: Simulation; cost: number } = best;
      for (const speedOffset of [-scale, 0, scale]) {
        for (const spinOffset of [-scale * 2, 0, scale * 2]) {
          if (speedOffset === 0 && spinOffset === 0) continue;
          const plan: ShotPlan = { ...center.plan, speed: clamp(center.plan.speed + speedOffset, 0.3, 3.6), topSpin: clamp(center.plan.topSpin + spinOffset, -1.3, 1.5) };
          const simulation = simulateShot(scenario, plan, { record: false });
          const legal = isLegalPot(simulation, ballId);
          const cost = (legal ? 0 : 8) + (simulation.scratch ? 5 : 0) + distance(simulation.cueEnd, target) * 3 + plan.speed * 0.025 + Math.abs(plan.topSpin) * 0.015;
          // Compare the same objective without the route's constant geometry cost.
          const current = (isLegalPot(best.simulation, ballId) ? 0 : 8) + (best.simulation.scratch ? 5 : 0) + distance(best.simulation.cueEnd, target) * 3 + best.plan.speed * 0.025 + Math.abs(best.plan.topSpin) * 0.015;
          if (cost < current) best = { plan, simulation, cost };
        }
      }
    }
  } else {
    best.plan = { ...best.plan, target: clampTarget(best.simulation.cueEnd) };
  }
  return best.plan;
}

export function analyzeShot(scenario: Scenario, plan: ShotPlan, samples = 48): ShotAnalysis {
  const count = clamp(Math.floor(samples), 8, 128);
  const tolerance = positionToleranceForLevel(scenario.level);
  const random = seededRandom(scenario.seed ^ 0x3A7B91);
  const nominal = simulateShot(scenario, plan);
  const endpoints: Vec2[] = [];
  const samplePaths: Vec2[][] = [];
  let pots = 0;
  let scratches = 0;
  let positions = 0;
  let successes = 0;
  let legalPots = 0;
  let quality = 0;
  // Same random perturbations for every candidate: common random numbers reduce
  // comparison noise. These are stroke errors, not invented success percentages.
  for (let index = 0; index < count; index++) {
    const perturbed: ShotPlan = {
      ...plan,
      angle: plan.angle + normalRandom(random) * (0.0044 + Math.abs(plan.sideSpin) * 0.000025),
      speed: plan.speed * (1 + normalRandom(random) * 0.035),
      topSpin: plan.topSpin + normalRandom(random) * 0.085,
      sideSpin: plan.sideSpin + normalRandom(random) * 3,
    };
    const simulation = simulateShot(scenario, perturbed, { record: index < 24 });
    const potted = simulation.potted.includes(plan.ballId) && simulation.firstContact === plan.ballId;
    const legal = potted && !simulation.scratch;
    const error = distance(simulation.cueEnd, plan.target);
    const positioned = !simulation.scratch && error <= tolerance;
    if (potted) pots++;
    if (simulation.scratch) scratches++;
    if (positioned) positions++;
    if (legal) legalPots++;
    if (legal && positioned) successes++;
    if (legal) quality += Math.exp(-(error * error) / (2 * tolerance ** 2));
    if (!simulation.scratch) endpoints.push(simulation.cueEnd);
    if (index < 24) samplePaths.push(simulation.cuePath);
  }
  const meanEnd = endpoints.length ? { x: endpoints.reduce((sum, p) => sum + p.x, 0) / endpoints.length, y: endpoints.reduce((sum, p) => sum + p.y, 0) / endpoints.length } : nominal.cueEnd;
  const spread = endpoints.length ? Math.sqrt(endpoints.reduce((sum, p) => sum + distance(p, meanEnd) ** 2, 0) / endpoints.length) : Math.hypot(TABLE.length, TABLE.width);
  const successRate = successes / count;
  // Pot AND position dominates. A missed pot or scratch never earns utility.
  const score = (0.72 * successes + 0.2 * quality + 0.08 * legalPots) / count;
  const explanation = successRate >= 0.8
    ? 'A generous pot and a repeatable cue-ball finish. Small stroke errors stay manageable.'
    : pots / count < 0.55
      ? 'The pot has a narrow margin. Small changes in aim often miss the pocket.'
      : scratches / count > 0.12
        ? 'The cue ball runs close to a pocket. Scratch risk makes this route less dependable.'
        : 'The pot is available, but speed and spin need care to hold the chosen cue-ball position.';
  return { plan, successRate, potRate: pots / count, scratchRate: scratches / count, positionRate: positions / count, spread, meanEnd, samplePaths, sampleEnds: endpoints, score, nominal, samples: count, explanation };
}

export function pointsFor(selected: Pick<ShotAnalysis, 'score' | 'successRate'>, best: Pick<ShotAnalysis, 'score'>): 0 | 0.5 | 1 {
  if (selected.successRate === 0 || best.score <= 0) return 0;
  if (selected.score >= best.score - 0.045) return 1;
  if (selected.score >= best.score - 0.18 && selected.score >= best.score * 0.72) return 0.5;
  return 0;
}

export function analyzeRound(scenario: Scenario, selection: Selection, options: AnalyzeOptions = {}): RoundAnalysis {
  if (!scenario.balls.some(ball => ball.id === selection.ballId && ball.id !== 0)) throw new Error('Choose an object ball before analyzing.');
  if (!Number.isFinite(selection.target.x) || !Number.isFinite(selection.target.y)) throw new Error('Choose a finite cue-ball target on the table.');
  const samples = options.samples ?? 48;
  const target = clampTarget(selection.target);
  const selectedPlan = findPlan(scenario, selection.ballId, target);
  selectedPlan.id += '-selected';
  const selected = analyzeShot(scenario, selectedPlan, samples);
  const candidates = scenario.balls.filter(ball => ball.id !== 0).map(ball => analyzeShot(scenario, findPlan(scenario, ball.id), samples));
  // A player's route is also a legitimate candidate for the most robust shot.
  candidates.push(selected);
  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];
  return { candidates, selected, best, points: pointsFor(selected, best), samples: selected.samples, positionTolerance: positionToleranceForLevel(scenario.level) };
}
