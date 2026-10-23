import { TABLE } from './constants';
import { POCKET_GEOMETRY } from './table-geometry';
import { clamp, distance, dot, normalize, segmentDistance, subtract } from './math';
import { simulateShot } from './physics';
import { hasProvenNextShot, satisfiesTrick } from './objectives';
import { bankPlanForStroke, bankRoutesFor } from './bank-routes';
import { plantRoutesFor } from './plant-routes';
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
  for (const char of JSON.stringify([scenario.level, scenario.seed, scenario.balls, scenario.objective, scenario.bank, scenario.plant, scenario.trick, scenario.curriculum?.englishPractice])) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return (hash >>> 0).toString(36);
}

function isSafeFinish(simulation: Simulation, ballId: number): boolean {
  const p = simulation.cueEnd;
  return simulation.stopped && !simulation.scratch && simulation.firstContact === ballId
    && p.x >= TABLE.ballRadius && p.x <= TABLE.length - TABLE.ballRadius
    && p.y >= TABLE.ballRadius && p.y <= TABLE.width - TABLE.ballRadius;
}

function isFeasible(simulation: Simulation, ballId: number): boolean {
  return isSafeFinish(simulation, ballId) && simulation.potted.includes(ballId);
}

/** Distinct endpoints alone are insufficient: every pair also changes strength
 * and longitudinal spin, so the ensembles describe different physical strokes. */
function pairIsDistinct(a: FeasiblePlan, b: FeasiblePlan): boolean {
  return Math.abs(a.plan.speed - b.plan.speed) >= 0.12
    && Math.abs(a.plan.topSpin - b.plan.topSpin) >= 0.35
    && distance(a.simulation.cueEnd, b.simulation.cueEnd) >= MIN_FINISH_SEPARATION;
}

function chooseTriple(plans: FeasiblePlan[], qualifies: (plan: FeasiblePlan) => boolean, englishPractice = false): [FeasiblePlan, FeasiblePlan, FeasiblePlan] | null {
  let chosen: [FeasiblePlan, FeasiblePlan, FeasiblePlan] | null = null;
  let bestCost = Infinity;
  for (let a = 0; a < plans.length - 2; a++) {
    for (let b = a + 1; b < plans.length - 1; b++) {
      if (!pairIsDistinct(plans[a], plans[b])) continue;
      for (let c = b + 1; c < plans.length; c++) {
        if (!pairIsDistinct(plans[a], plans[c]) || !pairIsDistinct(plans[b], plans[c])) continue;
        const triple: [FeasiblePlan, FeasiblePlan, FeasiblePlan] = [plans[a], plans[b], plans[c]];
        if (englishPractice && triple.filter(entry => entry.plan.sideSpin !== 0).length !== 1) continue;
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
  const isPlant = scenario.plant?.ballId === ballId;
  const trick = scenario.trick;
  const english = scenario.curriculum?.englishPractice;
  if (trick && !scenario.bank) {
    const cue = scenario.balls.find(ball => ball.id === 0)!;
    const angle = Math.atan2(trick.aim.y - cue.position.y, trick.aim.x - cue.position.x);
    for (const speed of [0.8, 1.0, 1.2, 1.4, 1.6, 1.8, 2.0, 2.25, 2.5, 2.8, 3.1, 3.4, 3.6]) {
      for (const topSpin of [-1.8, -1.4, -1.0, -0.6, 0, 0.6, 1.05, 1.5, 2.0]) {
        for (const sideSpin of english ? [0, -english, english] : [0]) {
          const plan: ShotPlan = { id: '', ballId, potBallId: trick.potBallId, pocketId: trick.pocketId,
            angle, speed, topSpin, sideSpin, target: { x: 0, y: 0 }, label: '' };
          const simulation = simulateShot(scenario, plan, { record: false });
          if (!isSafeFinish(simulation, ballId) || !satisfiesTrick(scenario, plan, simulation)) continue;
          plan.target = { ...simulation.cueEnd };
          feasible.push({ plan, simulation });
        }
      }
    }
    triple = chooseTriple(feasible, qualifies, Boolean(english));
  }
  if (isPlant) {
    const targetBallId = scenario.plant!.targetBallId;
    const targetStart = scenario.balls.find(ball => ball.id === targetBallId)!.position;
    for (const route of plantRoutesFor(scenario, ballId)) {
      for (const multiplier of [0.8, 0.95, 1.15, 1.4, 1.7, 2.1, 2.6]) {
        for (const topSpin of [-1.1, 0, 1.05]) {
          const plan: ShotPlan = { id: '', ballId, potBallId: targetBallId, pocketId: route.pocketId,
            angle: route.angle, speed: Math.min(3.6, route.speed * multiplier), topSpin, sideSpin: 0,
            target: { x: 0, y: 0 }, label: '' };
          const simulation = simulateShot(scenario, plan, { record: false });
          const targetEnd = simulation.finalBalls.find(ball => ball.id === targetBallId);
          if (!isSafeFinish(simulation, ballId) || !targetEnd || distance(targetStart, targetEnd.position) < 0.01) continue;
          plan.target = { ...simulation.cueEnd };
          feasible.push({ plan, simulation });
        }
      }
    }
    const pots = feasible.filter(entry => entry.simulation.potted.includes(targetBallId));
    // Successful plants receive proven nominal pots, just like direct shots.
    // A misaligned plant remains selectable with honest simulated miss paths.
    // This checks nominal feasibility only; ensemble quality never picks labels.
    triple = chooseTriple(pots, qualifies)
      ?? chooseTriple(feasible, entry => !pots.length || entry.simulation.potted.includes(targetBallId));
  }
  if (scenario.bank) {
    for (const route of bankRoutesFor(scenario, ballId)) {
      for (const speed of [1.3, 1.6, 1.95, 2.35, 2.8, 3.3, 3.45, 3.6, 3.8]) {
        for (const topSpin of [-1.1, 0, 0.5, 1.05, 1.6]) {
          const aimed = bankPlanForStroke(scenario, route, speed, topSpin);
          if (!aimed) continue;
          for (const correction of [0, -0.0005, 0.0005, -0.001, 0.001, -0.0015, 0.0015, -0.002, 0.002]) {
            const plan = { ...aimed, angle: aimed.angle + correction };
            const simulation = simulateShot(scenario, plan, { record: false });
            if (!isFeasible(simulation, ballId) || (simulation.cueBanksBeforeContact ?? 0) < scenario.bank.minCushions
              || !satisfiesTrick(scenario, plan, simulation)) continue;
            plan.target = { ...simulation.cueEnd };
            feasible.push({ plan, simulation });
            break;
          }
        }
      }
      triple = chooseTriple(feasible, qualifies);
      if (triple) break;
    }
  }
  for (const route of scenario.bank || isPlant || trick ? [] : routesFor(scenario, ballId)) {
    for (const multiplier of [0.95, 1.2, 1.5, 1.85, 2.3]) {
      for (const topSpin of [-1.1, 0, 1.05]) {
        for (const sideSpin of english ? [0, -english, english] : [0]) {
          const plan: ShotPlan = { id: '', ballId, pocketId: route.pocketId, angle: route.angle, speed: Math.min(3.6, route.speed * multiplier), topSpin, sideSpin, target: { x: 0, y: 0 }, label: '' };
          const simulation = simulateShot(scenario, plan, { record: false });
          if (isFeasible(simulation, ballId)) {
            plan.target = { ...simulation.cueEnd };
            feasible.push({ plan, simulation });
          }
        }
      }
    }
    triple = chooseTriple(feasible, qualifies, Boolean(english));
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
    const shot = trick ? `Trick shot ${ballId}` : isPlant ? `Plant ${ballId} → ${entry.plan.potBallId}` : `Ball ${ballId}`;
    // Record only the three offered routes, after feasibility has chosen them.
    const { cueApproachPath } = simulateShot(scenario, entry.plan, { record: false, recordPaths: true });
    return { id, label, cueApproachPath, plan: { ...entry.plan, id, label: `${shot} · ${label} · ${stroke}` } };
  }) as [FinishOption, FinishOption, FinishOption];
  return { ball: { ballId, options }, target };
}

function prepareLayout(scenario: Scenario): PreparedRound {
  if (scenario.trick) {
    const prepared = prepareBall(scenario, scenario.trick.ballId);
    return { scenario, balls: prepared ? [prepared.ball] : [] };
  }
  if (scenario.plant) {
    const plant = prepareBall(scenario, scenario.plant.ballId);
    const freeBalls = scenario.balls.filter(ball => ball.id !== 0 && ball.id !== scenario.plant!.ballId
      && ball.id !== scenario.plant!.targetBallId).flatMap(ball => {
      const prepared = prepareBall(scenario, ball.id);
      return prepared ? [prepared.ball] : [];
    });
    return { scenario, balls: plant && freeBalls.length ? [plant.ball, ...freeBalls] : [] };
  }
  if (scenario.bank) {
    const prepared = prepareBall(scenario, scenario.bank.ballId);
    return { scenario, balls: prepared ? [prepared.ball] : [] };
  }
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

/** Direct search tries at most 30 nominal strokes per object ball, or 90 when
 * an authored English lesson compares both side-spin directions with zero. Plant search
 * tries 21 strokes on the fixed pair line, retaining physically simulated misses.
 * Trick search tries 117 strokes on its authored contact line (351 with English),
 * retaining only complete, physically proven tricks before choosing three finishes.
 * Bank search tries 12 routes, nine speeds and five spins with angle calibration.
 * Authored lessons can try three replacement layouts of the same lesson;
 * fixed objectives never fall back to an unrelated easier layout. Passing
 * regenerate: false searches only the supplied table, as required for sandbox. */
export function prepareRound(scenario: Scenario, options: { regenerate?: boolean } = {}): PreparedRound {
  if (!scenario.balls.some(ball => ball.id === 0)) throw new Error('The table needs a cue ball.');
  const objective = scenario.objective;
  const bank = scenario.bank;
  const plant = scenario.plant;
  const trick = scenario.trick;
  if (trick && (objective || plant)) throw new Error('A trick shot cannot also define a plant or position objective.');
  if (trick && (!scenario.balls.some(ball => ball.id === trick.ballId && ball.id > 0)
    || !scenario.balls.some(ball => ball.id === trick.potBallId && ball.id > 0)
    || !POCKET_GEOMETRY.some(pocket => pocket.id === trick.pocketId)
    || ![trick.aim.x, trick.aim.y].every(Number.isFinite)
    || !trick.requiredPots.length || !trick.requiredPots.includes(trick.potBallId)
    || trick.requiredPots.some(id => !scenario.balls.some(ball => ball.id === id && id > 0))
    || !trick.requiredContacts.length
    || trick.requiredContacts.some(pair => pair.length !== 2 || pair[0] === pair[1]
      || pair.some(id => !scenario.balls.some(ball => ball.id === id)))
    || (trick.minObjectCushions !== undefined && (!Number.isInteger(trick.minObjectCushions) || trick.minObjectCushions < 1)))) {
    throw new Error('The trick shot needs its target balls, pocket, aim line and physical contact sequence.');
  }
  if (bank && objective) throw new Error('A bank lesson cannot also define a position objective.');
  if (plant && (bank || objective)) throw new Error('A plant decision cannot also define a bank or position objective.');
  if (plant && (!Number.isInteger(plant.ballId) || !Number.isInteger(plant.targetBallId)
    || plant.ballId <= 0 || plant.targetBallId <= 0 || plant.ballId === plant.targetBallId
    || !POCKET_GEOMETRY.some(pocket => pocket.id === plant.pocketId)
    || !scenario.balls.some(ball => ball.id === plant.ballId) || !scenario.balls.some(ball => ball.id === plant.targetBallId)
    || !scenario.balls.some(ball => ball.id !== 0 && ball.id !== plant.ballId && ball.id !== plant.targetBallId))) {
    throw new Error('The plant decision needs two distinct object balls, a pocket and at least one free ball.');
  }
  if (bank && (!Number.isInteger(bank.ballId) || bank.ballId <= 0 || !Number.isInteger(bank.minCushions)
    || bank.minCushions < 1 || bank.minCushions > 3 || !scenario.balls.some(ball => ball.id === bank.ballId))) {
    throw new Error('The bank lesson needs an object ball on the table and one to three required cue-ball cushions.');
  }
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
  const attempts = options.regenerate === false || ((objective || bank || plant || trick) && !scenario.curriculum) ? 1 : 4;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const generated = attempt === 0 ? scenario : generateScenario(scenario.level, (scenario.seed + Math.imul(attempt, 0x9E3779B1)) >>> 0);
    // Regeneration keeps the lesson; plant pockets and trick aim lines follow
    // the regenerated table reflection along with the balls.
    const layout = { ...scenario, seed: generated.seed, balls: generated.balls,
      ...(plant ? { plant: { ...plant, pocketId: generated.plant?.pocketId ?? plant.pocketId } } : {}),
      ...(trick ? { trick: generated.trick ?? trick } : {}) };
    const prepared = prepareLayout(layout);
    if (prepared.balls.length) return prepared;
  }
  if (options.regenerate === false || scenario.curriculum || objective || bank || plant || trick) throw new Error('No feasible three-finish layout could be prepared for this lesson and its objective.');
  const openLayout: Scenario = { ...scenario, seed: 72350, balls: generateScenario(1, 72350).balls };
  const prepared = prepareLayout(openLayout);
  if (!prepared.balls.length) throw new Error('No feasible three-finish layout could be prepared.');
  return prepared;
}
