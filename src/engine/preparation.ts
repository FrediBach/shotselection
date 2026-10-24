import { authorPlantQualityTargets } from './plant-quality';
import { plantGapPreview } from './plant-gap';
import { plantThrowExperiment } from './plant-throw';
import { plantDistanceExperiment } from './plant-distance';
import { plantDeliveryPreview } from './plant-delivery';
import { plantMarginExperiment } from './plant-margin';
import { plantLinePreview } from './plant-line';
import { plantIntroductionPreview } from './plant-introduction';
import { kickFinalPreview } from './kick-final';
import { kickErrorExperiment } from './kick-error';
import { kickMiddleExperiment } from './kick-middle';
import { kickSequencePreview } from './kick-sequence';
import { kickFinishExperiment } from './kick-finish';
import { kickCorridorExperiment } from './kick-corridor';
import { kickSpinExperiment } from './kick-spin';
import { kickPaceExperiment } from './kick-pace';
import { kickContactEvidence } from './kick-contact';
import { elongatedPositionFinder } from './elongated-position';
import { positionRegionRatio } from './position-region';
import { englishRoutingFinder } from './english-routing';
import { corridorCenterPairFinder } from './corridor-center';
import { returnLanePairFinder } from './return-lane';
import { collisionAssistancePairFinder } from './collision-assistance';
import { openCorridorEvidence, openCorridorPair } from './open-corridor';
import { pocketChangePairFinder } from './pocket-change';
import { spareGrazePairFinder } from './spare-graze';
import { movingTrafficPairFinder } from './moving-traffic';
import { ballWidthEvidence } from './ball-width';
import { fallbackPairFinder } from './fallback-plan';
import { sequenceWitness } from './sequence-reliability';
import { steppingStoneEvidence } from './stepping-stone';
import { corridorPairFinder } from './corridor-diagnosis';
import { zoneExitPairFinder } from './zone-exit';
import { lookAheadPairFinder } from './look-ahead';
import { keyBallEvidence } from './key-ball';
import { findNominatedBallContrasts } from './nominated-ball';
import { signedAngleEvidence } from './signed-angle';
import { buildDrawDecayExperiment } from './draw-decay';
import { contactAccessEvidence } from './contact-access';
import { angleTrapEvidence, isOvershootPair } from './angle-trap';
import { buildBackwardPlan } from './backward-planning';
import { nextShotBlockerEvidence, postContactRebounds } from './lesson-evidence';
import { supportsGeometryComparison } from './shot-geometry';
import { buildEverydayExperiment, needsEverydayExperiment } from './everyday-experiments';
import { isStopContact, isRollingContact } from './position-learning';
import { TABLE } from './constants';
import { POCKET_GEOMETRY } from './table-geometry';
import { clamp, distance, dot, normalize, segmentDistance, subtract } from './math';
import { simulateShot } from './physics';
import { directShotRoutes, hasProvenNextShot, satisfiesTrick } from './objectives';
import { bankPlanForStroke, bankRoutesFor } from './bank-routes';
import { plantRoutesFor } from './plant-routes';
import { generateScenario } from './scenarios';
import { clothFrictionAt, reflectTableConditions } from './table-conditions';
import type { BallFinishOptions, FinishOption, PreparedRound, Scenario, ShotPlan, Simulation, Vec2 } from './types';

interface Route { pocketId: number; angle: number; speed: number; difficulty: number }
interface FeasiblePlan { plan: ShotPlan; simulation: Simulation }
export const MIN_FINISH_SEPARATION = 0.12;

function routesFor(scenario: Scenario, ballId: number): Route[] {
  if (scenario.curriculum?.learning?.comparison === 'key-ball') return directShotRoutes(scenario.balls, ballId, 80).slice(0, 2).map(route => ({ ...route, difficulty: route.cutAngle }));
  const cue = scenario.balls.find(ball => ball.id === 0)!;
  const object = scenario.balls.find(ball => ball.id === ballId)!;
  const routes: Route[] = [];
  const requiredPocket = scenario.curriculum?.learning?.pockets?.find(route => route.ballId === ballId)?.pocketId;
  for (const pocket of POCKET_GEOMETRY) {
    if (requiredPocket !== undefined && pocket.id !== requiredPocket) continue;
    if (scenario.curriculum?.learning?.comparison === 'cut-paths' && pocket.kind !== 'side') continue;
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
    const baseSpeed = Math.sqrt(2 * TABLE.rollingFriction * 9.80665 * (objectDistance + 0.13)) / (0.71 * cut) + cueDistance * 0.2;
    // Budget for the actual cloth along both legs, including local repairs.
    const drag = scenario.conditions ? [0.125, 0.375, 0.625, 0.875].reduce((sum, t) => sum
      + clothFrictionAt({ x: cue.position.x + (ghost.x - cue.position.x) * t, y: cue.position.y + (ghost.y - cue.position.y) * t }, scenario.conditions)
      + clothFrictionAt({ x: object.position.x + (pocket.center.x - object.position.x) * t, y: object.position.y + (pocket.center.y - object.position.y) * t }, scenario.conditions), 0) / 8 : 1;
    const speed = clamp(baseSpeed * Math.sqrt(drag) / (scenario.conditions?.cue?.power ?? 1), 0.65, scenario.conditions ? 3.4 : 2.8);
    routes.push({ pocketId: pocket.id, angle: Math.atan2(aim.y, aim.x), speed, difficulty: cueDistance * 0.15 + objectDistance * 0.18 + (1 - cut) * 0.8 });
  }
  return routes.sort((a, b) => a.difficulty - b.difficulty).slice(0, 2);
}

function scenarioFingerprint(scenario: Scenario): string {
  let hash = 2166136261;
  const identity: unknown[] = [scenario.level, scenario.seed, scenario.balls, scenario.objective, scenario.bank, scenario.plant, scenario.trick, scenario.curriculum?.englishPractice, scenario.curriculum?.learning];
  if (scenario.conditions) identity.push(scenario.conditions);
  for (const char of JSON.stringify(identity)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
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

/** Compensate the fixed cue bias and use the slope to seed an actual simulated
 * angle search. A damaged table must earn its pots under its own physics. */
function directStroke(scenario: Scenario, plan: ShotPlan): FeasiblePlan | null {
  if (!scenario.conditions) {
    const simulation = simulateShot(scenario, plan, { record: false });
    return isFeasible(simulation, plan.ballId) ? { plan, simulation } : null;
  }
  const { cue, nap } = scenario.conditions;
  const cueBall = scenario.balls.find(ball => ball.id === 0)!;
  const object = scenario.balls.find(ball => ball.id === plan.ballId)!;
  const approach = Math.max(0.08, distance(cueBall.position, object.position) - TABLE.ballDiameter);
  const rollingSpeed = plan.speed * (cue?.power ?? 1) * Math.max(0.3, (5 + 2 * plan.topSpin * (cue?.spin ?? 1)) / 7);
  const time = approach / Math.max(0.2, rollingSpeed * 0.9);
  const bend = nap ? (Math.cos(plan.angle) * nap.y - Math.sin(plan.angle) * nap.x) * time * time / (2 * approach) : 0;
  const baseAngle = plan.angle - (cue?.angleBias ?? 0) - clamp(bend, -0.075, 0.075);
  const corrections = nap || scenario.conditions.dirt
    ? [0, -0.002, 0.002, -0.005, 0.005, -0.01, 0.01, -0.018, 0.018, -0.028, 0.028, -0.042, 0.042, -0.06, 0.06]
    : [0];
  for (const correction of corrections) {
    const calibrated = { ...plan, angle: baseAngle + correction };
    const simulation = simulateShot(scenario, calibrated, { record: false });
    if (isFeasible(simulation, plan.ballId)) return { plan: calibrated, simulation };
  }
  return null;
}

/** Distinct endpoints alone are insufficient: every pair also changes strength
 * and longitudinal spin, so the ensembles describe different physical strokes. */
function pairIsDistinct(a: FeasiblePlan, b: FeasiblePlan): boolean {
  return Math.abs(a.plan.speed - b.plan.speed) >= 0.12
    && Math.abs(a.plan.topSpin - b.plan.topSpin) >= 0.35
    && distance(a.simulation.cueEnd, b.simulation.cueEnd) >= MIN_FINISH_SEPARATION;
}

function chooseTriple(plans: FeasiblePlan[], qualifies: (plan: FeasiblePlan) => boolean, englishPractice = false, contrast: (plans: FeasiblePlan[]) => boolean = () => true): [FeasiblePlan, FeasiblePlan, FeasiblePlan] | null {
  let chosen: [FeasiblePlan, FeasiblePlan, FeasiblePlan] | null = null;
  let bestCost = Infinity;
  for (let a = 0; a < plans.length - 2; a++) {
    for (let b = a + 1; b < plans.length - 1; b++) {
      if (!pairIsDistinct(plans[a], plans[b])) continue;
      for (let c = b + 1; c < plans.length; c++) {
        if (!pairIsDistinct(plans[a], plans[c]) || !pairIsDistinct(plans[b], plans[c])) continue;
        const triple: [FeasiblePlan, FeasiblePlan, FeasiblePlan] = [plans[a], plans[b], plans[c]];
        if (englishPractice && triple.filter(entry => entry.plan.sideSpin !== 0).length !== 1) continue;
        if (!triple.some(qualifies) || !contrast(triple)) continue;
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

function prepareBall(scenario: Scenario, ballId: number): { ball: BallFinishOptions; target?: Vec2; contactAccessPocket?: number; signedAnglePreview?: PreparedRound['signedAnglePreview']; lookAheadOptionIds?: string[]; steppingStoneOptionId?: string; sequenceComparison?: PreparedRound['sequenceComparison']; zoneExit?: PreparedRound['zoneExit']; fallbackPlan?: PreparedRound['fallbackPlan']; movingTraffic?: PreparedRound['movingTraffic']; spareGraze?: PreparedRound['spareGraze']; pocketChange?: PreparedRound['pocketChange']; collisionAssistance?: PreparedRound['collisionAssistance']; returnLane?: PreparedRound['returnLane']; corridorCenter?: PreparedRound['corridorCenter']; englishRouting?: PreparedRound['englishRouting']; elongatedPosition?: PreparedRound['elongatedPosition'] } | null {
  if (!scenario.balls.some(ball => ball.id === ballId)) return null;
  const feasible: FeasiblePlan[] = [];
  const comparison = scenario.curriculum?.learning?.comparison;
  const sequenceEvidence = new Map<FeasiblePlan, ReturnType<typeof sequenceWitness>>();
  const sequenceCheck = (entry: FeasiblePlan) => {
    if (!sequenceEvidence.has(entry)) sequenceEvidence.set(entry, sequenceWitness(scenario, entry.simulation));
    return sequenceEvidence.get(entry)!;
  };
  const steppingEvidence = new Map<FeasiblePlan, ReturnType<typeof steppingStoneEvidence>>();
  const steppingCheck = (entry: FeasiblePlan) => {
    if (!steppingEvidence.has(entry)) steppingEvidence.set(entry, steppingStoneEvidence(scenario, entry.simulation));
    return steppingEvidence.get(entry)!;
  };
  const corridorPair = corridorPairFinder(scenario);
  const elongatedPair = elongatedPositionFinder(scenario);
  const englishRoute = englishRoutingFinder(scenario);
  const centerPair = corridorCenterPairFinder(scenario);
  const returnPair = returnLanePairFinder(scenario);
  const assistedPair = collisionAssistancePairFinder(scenario);
  const pocketPair = pocketChangePairFinder(scenario);
  const grazePair = spareGrazePairFinder(scenario);
  const trafficPair = movingTrafficPairFinder(scenario);
  const fallbackPair = fallbackPairFinder(scenario);
  const zoneExitPair = zoneExitPairFinder(scenario);
  const lookAheadPair = lookAheadPairFinder(scenario);
  const keyEvidence = new Map<FeasiblePlan, ReturnType<typeof keyBallEvidence>>();
  const keyCheck = (entry: FeasiblePlan) => {
    if (!keyEvidence.has(entry)) keyEvidence.set(entry, keyBallEvidence(scenario, entry.plan, entry.simulation));
    return keyEvidence.get(entry)!;
  };
  const contrast = (entries: FeasiblePlan[]) => {
    if (comparison === 'corridor-diagnosis') return Boolean(corridorPair(entries));
    if (comparison === 'elongated-position') return Boolean(elongatedPair(entries));
    if (comparison === 'english-routing') return Boolean(englishRoute(entries));
    if (comparison === 'corridor-center') return Boolean(centerPair(entries));
    if (comparison === 'return-lane') return Boolean(returnPair(entries));
    if (comparison === 'collision-assistance') return Boolean(assistedPair(entries));
    if (comparison === 'pocket-change') return Boolean(pocketPair(entries));
    if (comparison === 'spare-graze') return Boolean(grazePair(entries));
    if (comparison === 'moving-traffic') return Boolean(trafficPair(entries));
    if (comparison === 'fallback-plan') return Boolean(fallbackPair(entries));
    if (comparison === 'zone-exit') return Boolean(zoneExitPair(entries));
    if (comparison === 'look-ahead' || comparison === 'angle-travel') return Boolean(lookAheadPair(entries));
    if (comparison === 'key-ball') return entries.some(entry => keyCheck(entry).kept) && entries.some(entry => keyCheck(entry).lost);
    if (comparison === 'contact-roll') return entries.every(entry => entry.plan.pocketId === entries[0].plan.pocketId)
      && entries.some(entry => isStopContact(scenario, entry.plan, entry.simulation) && qualifies(entry))
      && entries.some(entry => isRollingContact(scenario, entry.plan, entry.simulation));
    if (comparison === 'next-angle-trap' || comparison === 'contact-access' || comparison === 'position-overshoot' || comparison === 'signed-next-angle') return Boolean(anglePair(entries));
    if (comparison === 'zone-margin') return Boolean(marginCenter(entries));
    if (comparison === 'cut-paths') return entries.every(entry => entry.plan.pocketId === entries[0].plan.pocketId);
    if (comparison === 'cue-rebound' || (comparison === 'avoidable-cushion' && ballId === 1)) return (comparison !== 'avoidable-cushion' || entries.every(entry => entry.plan.pocketId === entries[0].plan.pocketId)) && entries.some(entry => postContactRebounds(entry.simulation).length > 0)
      && entries.some(entry => postContactRebounds(entry.simulation).length === 0);
    if (comparison === 'next-shot-blocker') {
      const evidence = entries.map(entry => nextShotBlockerEvidence(scenario, entry.simulation));
      return evidence.some(item => item.routes.length === 0 && item.blockedRoutes.length > 0)
        && evidence.some(item => item.routes.length > 0);
    }
    return true;
  };
  const qualified = new Map<FeasiblePlan, boolean>();
  const qualifies = (entry: FeasiblePlan): boolean => {
    if (comparison === 'english-routing') return Boolean(englishRoute([entry]));
    if (comparison === 'sequence-reliability') return (!scenario.objective!.target || distance(entry.simulation.cueEnd, scenario.objective!.target) <= scenario.objective!.radius) && Boolean(sequenceCheck(entry));
    if (comparison === 'stepping-stone') return (!scenario.objective!.target || distance(entry.simulation.cueEnd, scenario.objective!.target) <= scenario.objective!.radius) && Boolean(steppingCheck(entry));
    if (comparison === 'key-ball') return keyCheck(entry).kept;
    if (comparison === 'open-corridor') {
      if (!qualified.has(entry)) qualified.set(entry, Boolean(openCorridorEvidence(scenario, entry)));
      return qualified.get(entry)!;
    }
    if (!scenario.objective) return true;
    const cached = qualified.get(entry);
    if (cached !== undefined) return cached;
    const objective = scenario.objective;
    const result = (!objective.target || positionRegionRatio(objective, entry.simulation.cueEnd) <= 1)
      && hasProvenNextShot(scenario, entry.simulation);
    qualified.set(entry, result);
    return result;
  };
  // Nominal geometry only: never optimize against the later error ensembles.
  const marginCenter = (entries: FeasiblePlan[]) => entries.find(center => entries.some(edge => {
    if (center === edge || center.plan.pocketId !== edge.plan.pocketId) return false;
    const objective = scenario.objective!;
    const target = objective.target ?? center.simulation.cueEnd;
    const centralDistance = distance(center.simulation.cueEnd, target);
    const edgeDistance = distance(edge.simulation.cueEnd, target);
    return centralDistance <= objective.radius * .2 && edgeDistance >= objective.radius * .7
      && edgeDistance <= objective.radius * .95 && qualifies(center) && qualifies(edge);
  }));
  const angleEvidence = new Map<FeasiblePlan, ReturnType<typeof angleTrapEvidence>>();
  const evidenceFor = (entry: FeasiblePlan) => {
    if (!angleEvidence.has(entry)) angleEvidence.set(entry, angleTrapEvidence(scenario, entry.simulation));
    return angleEvidence.get(entry)!;
  };
  const anglePair = (entries: FeasiblePlan[]) => {
    const objective = scenario.objective!;
    for (const near of entries) for (const far of entries) {
      if (near === far || near.plan.pocketId !== far.plan.pocketId
        || near.simulation.ballContacts?.length !== 1 || far.simulation.ballContacts?.length !== 1) continue;
      const target = objective.target ?? { x: (near.simulation.cueEnd.x + far.simulation.cueEnd.x) / 2, y: (near.simulation.cueEnd.y + far.simulation.cueEnd.y) / 2 };
      if (distance(near.simulation.cueEnd, target) > objective.radius * .95 || distance(far.simulation.cueEnd, target) > objective.radius * .95) continue;
      const a = evidenceFor(near), b = evidenceFor(far);
      if (comparison === 'signed-next-angle') {
        if (!qualifies(near) || !qualifies(far)) continue;
        for (const route of a.permitted) {
          const left = signedAngleEvidence(scenario, near.simulation, route.pocketId);
          const right = signedAngleEvidence(scenario, far.simulation, route.pocketId);
          if (!left || !right || left.angle * right.angle >= 0
            || Math.min(Math.abs(left.angle), Math.abs(right.angle)) < 8
            || Math.max(left.cutAngle, right.cutAngle) > objective.maxCutAngle - 3) continue;
          const previewTarget = { x: left.ghost.x + left.departure.x * .35, y: left.ghost.y + left.departure.y * .35 };
          if (previewTarget.x < .12 || previewTarget.x > TABLE.length - .12 || previewTarget.y < .12 || previewTarget.y > TABLE.width - .12) continue;
          return { near, far, target, signedAnglePreview: { pocketId: route.pocketId, target: previewTarget, radius: .09 } };
        }
        continue;
      }
      if (comparison === 'position-overshoot') {
        if (!isOvershootPair(near.simulation, far.simulation)
          || a.permitted.length || !a.best || a.best.cutAngle < objective.maxCutAngle + 3
          || !b.permitted.length || b.permitted[0].cutAngle > objective.maxCutAngle - 3 || !qualifies(far)) continue;
        return { near, far, target };
      }
      if (comparison === 'contact-access') {
        if (a.distance === null || b.distance === null || a.distance < TABLE.ballDiameter + .002 || a.distance > .18
          || b.distance - a.distance < .08 || a.unrestricted.length || !b.permitted.length || !qualifies(far)) continue;
        for (const route of b.permitted) {
          const close = contactAccessEvidence(scenario, near.simulation, route.pocketId);
          const open = contactAccessEvidence(scenario, far.simulation, route.pocketId);
          if (close?.visible && close.prematureContact && open?.permitted && !open.prematureContact)
            return { near, far, target, pocketId: route.pocketId };
        }
        continue;
      }
      if (a.distance === null || b.distance === null || b.distance - a.distance < .05
        || a.permitted.length || !a.best || a.best.cutAngle < objective.maxCutAngle + 3
        || !b.permitted.length || b.permitted[0].cutAngle > objective.maxCutAngle - 3 || !qualifies(far)) continue;
      return { near, far, target };
    }
    return null;
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
    for (const multiplier of comparison === 'elongated-position' || comparison === 'english-routing' || comparison === 'corridor-center' || comparison === 'return-lane' || comparison === 'collision-assistance' || comparison === 'open-corridor' || comparison === 'pocket-change' || comparison === 'spare-graze' || comparison === 'moving-traffic' || comparison === 'fallback-plan' || comparison === 'sequence-reliability' || comparison === 'stepping-stone' || comparison === 'corridor-diagnosis' || comparison === 'angle-travel' || comparison === 'zone-exit' || comparison === 'look-ahead' || comparison === 'key-ball' || comparison === 'cut-paths' || comparison === 'cue-rebound' || comparison === 'avoidable-cushion' || comparison === 'zone-margin' || comparison === 'next-angle-trap' || comparison === 'contact-access' || comparison === 'position-overshoot' || comparison === 'signed-next-angle' || scenario.curriculum?.learning?.pockets ? [0.8, 0.95, 1.1, 1.2, 1.4, 1.5, 1.7, 1.85, 2.1, 2.3, 2.6, 3, 3.5] : [0.95, 1.2, 1.5, 1.85, 2.3]) {
      for (const topSpin of comparison === 'return-lane' || comparison === 'english-routing' || comparison === 'elongated-position' ? [-1.6, -1.1, -.6, 0, .5, 1.05] : comparison === 'contact-roll' ? [-1.1, -.75, -.5, -.25, 0, .5, 1.05] : [-1.1, 0, 1.05]) {
        for (const sideSpin of english ? [0, -english, english] : [0]) {
          const plan: ShotPlan = { id: '', ballId, pocketId: route.pocketId, angle: route.angle, speed: Math.min(3.6, route.speed * multiplier), topSpin, sideSpin, target: { x: 0, y: 0 }, label: '' };
          const calibrated = directStroke(scenario, plan);
          if (calibrated) {
            calibrated.plan.target = { ...calibrated.simulation.cueEnd };
            feasible.push(calibrated);
          }
        }
      }
    }
    // A controlled English reference already proves both next shots. Reject
    // unsuitable layouts before enumerating triples or proving unrelated pots.
    if (comparison === 'english-routing' && !englishRoute(feasible)) continue;
    if (comparison === 'elongated-position' && !elongatedPair(feasible)) continue;
    triple = chooseTriple(feasible, qualifies, Boolean(english), contrast);
    if (triple) break; // Prefer three strokes to the same pocket when possible.
  }
  if (!triple) return null;
  const sequence = comparison === 'sequence-reliability' ? triple.find(qualifies)! : null;
  const steppingStone = comparison === 'stepping-stone' ? triple.find(qualifies)! : null;
  const positionPair = comparison === 'next-angle-trap' || comparison === 'contact-access' || comparison === 'position-overshoot' || comparison === 'signed-next-angle' ? anglePair(triple)! : null;
  const lookAhead = comparison === 'look-ahead' || comparison === 'angle-travel' ? lookAheadPair(triple)! : null;
  const zoneExit = comparison === 'zone-exit' ? zoneExitPair(triple)! : null;
  const fallback = comparison === 'fallback-plan' ? fallbackPair(triple)! : null;
  const traffic = comparison === 'moving-traffic' ? trafficPair(triple)! : null;
  const graze = comparison === 'spare-graze' ? grazePair(triple)! : null;
  const pocketChange = comparison === 'pocket-change' ? pocketPair(triple)! : null;
  const assistance = comparison === 'collision-assistance' ? assistedPair(triple)! : null;
  const elongatedPosition = comparison === 'elongated-position' ? elongatedPair(triple)! : null;
  const englishRouting = comparison === 'english-routing' ? englishRoute(triple)! : null;
  const corridorCenter = comparison === 'corridor-center' ? centerPair(triple)! : null;
  const returnLane = comparison === 'return-lane' ? returnPair(triple)! : null;
  const target = elongatedPosition ? elongatedPosition.target : englishRouting ? englishRouting.target : corridorCenter ? corridorCenter.target : returnLane ? returnLane.target : assistance ? assistance.target : pocketChange ? pocketChange.target : graze ? graze.target : traffic ? traffic.target : fallback ? fallback.target : zoneExit ? zoneExit.target : lookAhead ? lookAhead.target : positionPair ? positionPair.target : scenario.objective ? { ...(scenario.objective.target ?? (comparison === 'zone-margin' ? marginCenter(triple)! : comparison === 'contact-roll' ? triple.find(entry => isStopContact(scenario, entry.plan, entry.simulation) && qualifies(entry))! : triple.find(qualifies)!).simulation.cueEnd) } : undefined;
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
  return { ball: { ballId, options }, target, ...(elongatedPosition ? { elongatedPosition: { alongId: options[triple.indexOf(elongatedPosition.along)].id, acrossId: options[triple.indexOf(elongatedPosition.across)].id } } : {}), ...(englishRouting ? { englishRouting: { referenceId: options[triple.indexOf(englishRouting.opening)].id } } : {}), ...(corridorCenter ? { corridorCenter: { centerId: options[triple.indexOf(corridorCenter.center)].id, edgeId: options[triple.indexOf(corridorCenter.edge)].id } } : {}), ...(returnLane ? { returnLane: { riskyId: options[triple.indexOf(returnLane.risky)].id, clearId: options[triple.indexOf(returnLane.clear)].id } } : {}), ...(assistance ? { collisionAssistance: { assistedId: options[triple.indexOf(assistance.assisted)].id, clearId: options[triple.indexOf(assistance.clear)].id } } : {}), ...(pocketChange ? { pocketChange: { originalId: options[triple.indexOf(pocketChange.original)].id, adaptedId: options[triple.indexOf(pocketChange.adapted)].id, preferredPocketId: pocketChange.preferred.pocketId, alternatePocketId: pocketChange.alternate.pocketId, blockerId: pocketChange.blocker.id } } : {}), ...(graze ? { spareGraze: { grazedId: options[triple.indexOf(graze.grazed)].id, clearId: options[triple.indexOf(graze.clear)].id } } : {}), ...(traffic ? { movingTraffic: { blockedId: options[triple.indexOf(traffic.blocked)].id, clearId: options[triple.indexOf(traffic.clear)].id, pocketId: traffic.pocketId } } : {}), ...(fallback ? { fallbackPlan: { narrowId: options[triple.indexOf(fallback.narrow)].id, flexibleId: options[triple.indexOf(fallback.flexible)].id } } : {}), ...(sequence ? { sequenceComparison: { referenceId: options[triple.indexOf(sequence)].id, orders: sequenceCheck(sequence)!.orders.map(({first, second}) => ({first, second})) } } : {}), ...(steppingStone ? { steppingStoneOptionId: options[triple.indexOf(steppingStone)].id } : {}), ...(zoneExit ? { zoneExit: { blockedId: options[triple.indexOf(zoneExit.blocked)].id, clearId: options[triple.indexOf(zoneExit.clear)].id, blockerId: zoneExit.blockerId, pocketId: zoneExit.pocketId } } : {}), ...(lookAhead ? { lookAheadOptionIds: [lookAhead.lost.opening, lookAhead.kept.opening].map(entry => options[triple.indexOf(entry)].id).sort() } : {}), ...(comparison === 'signed-next-angle' ? { signedAnglePreview: { ...positionPair!.signedAnglePreview!, choices: [positionPair!.near, positionPair!.far].map(entry => ({
    ...signedAngleEvidence(scenario, entry.simulation, positionPair!.signedAnglePreview!.pocketId)!,
    optionId: options[triple.indexOf(entry)].id, label: options[triple.indexOf(entry)].label, cue: entry.simulation.cueEnd,
  })).sort((a, b) => a.label.localeCompare(b.label)) } } : {}), ...(comparison === 'contact-access' ? { contactAccessPocket: positionPair!.pocketId } : {}) };
}

function prepareLayout(scenario: Scenario): PreparedRound {
  if (scenario.curriculum?.learning?.comparison === 'ball-width' && !ballWidthEvidence(scenario)) return { scenario, balls: [] };
  if (scenario.curriculum?.learning?.comparison === 'open-corridor') {
    const balls = [1, 3].flatMap(id => { const p = prepareBall(scenario, id); return p ? [p.ball] : []; });
    const pair = openCorridorPair(scenario, balls.flatMap(b => b.options.map(o => ({ plan: o.plan, simulation: simulateShot(scenario, o.plan, { record: false }) }))));
    return pair ? { scenario, balls, openCorridor: { openedId: pair.opened.opening.plan.id, blockedId: pair.blocked.opening.plan.id, pocketId: pair.pocketId } } : { scenario, balls: [] };
  }
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
    if (plant && freeBalls.length && scenario.curriculum?.learning?.comparison === 'plant-quality') {
      return { scenario, balls: authorPlantQualityTargets(scenario, [plant.ball, ...freeBalls]) };
    }
    if (plant && freeBalls.length && scenario.curriculum?.learning?.comparison === 'plant-gap') {
      const plantGap = plantGapPreview(scenario, plant.ball.options);
      return plantGap ? { scenario, balls: [plant.ball, ...freeBalls], plantGap } : { scenario, balls: [] };
    }
    if (plant && freeBalls.length && scenario.curriculum?.learning?.comparison === 'plant-throw') {
      const plantThrow = plantThrowExperiment(scenario, plant.ball.options);
      return plantThrow ? { scenario, balls: [plant.ball, ...freeBalls], plantThrow } : { scenario, balls: [] };
    }
    if (plant && freeBalls.length && scenario.curriculum?.learning?.comparison === 'plant-distance') {
      const plantDistance = plantDistanceExperiment(scenario, plant.ball.options);
      return plantDistance ? { scenario, balls: [plant.ball, ...freeBalls], plantDistance } : { scenario, balls: [] };
    }
    if (plant && freeBalls.length && scenario.curriculum?.learning?.comparison === 'plant-delivery') {
      const plantDelivery = plantDeliveryPreview(scenario, plant.ball.options);
      return plantDelivery ? { scenario, balls: [plant.ball, ...freeBalls], plantDelivery } : { scenario, balls: [] };
    }
    if (plant && freeBalls.length && scenario.curriculum?.learning?.comparison === 'plant-margin') {
      const plantMargin = plantMarginExperiment(scenario, plant.ball.options);
      return plantMargin ? { scenario, balls: [plant.ball, ...freeBalls], plantMargin } : { scenario, balls: [] };
    }
    if (plant && freeBalls.length && scenario.curriculum?.learning?.comparison === 'plant-line') {
      const plantLine = plantLinePreview(scenario, plant.ball.options);
      return plantLine ? { scenario, balls: [plant.ball, ...freeBalls], plantLine } : { scenario, balls: [] };
    }
    if (plant && freeBalls.length && scenario.curriculum?.learning?.comparison === 'plant-introduction') {
      const plantIntroduction = plantIntroductionPreview(scenario, plant.ball.options);
      return plantIntroduction ? { scenario, balls: [plant.ball, ...freeBalls], plantIntroduction } : { scenario, balls: [] };
    }
    return { scenario, balls: plant && freeBalls.length ? [plant.ball, ...freeBalls] : [] };
  }
  if (scenario.bank) {
    const prepared = prepareBall(scenario, scenario.bank.ballId);
    if (prepared && scenario.curriculum?.learning?.comparison === 'kick-final') {
      const kickFinal = kickFinalPreview(scenario, prepared.ball.options);
      return kickFinal ? { scenario, balls: [prepared.ball], kickFinal } : { scenario, balls: [] };
    }
    if (prepared && scenario.curriculum?.learning?.comparison === 'kick-error') {
      const kickError = kickErrorExperiment(scenario, prepared.ball.options);
      return kickError ? { scenario, balls: [prepared.ball], kickError } : { scenario, balls: [] };
    }
    if (prepared && scenario.curriculum?.learning?.comparison === 'kick-middle') {
      const kickMiddle = kickMiddleExperiment(scenario, prepared.ball.options);
      return kickMiddle ? { scenario, balls: [prepared.ball], kickMiddle } : { scenario, balls: [] };
    }
    if (prepared && scenario.curriculum?.learning?.comparison === 'kick-sequence') {
      const kickSequence = kickSequencePreview(scenario, prepared.ball.options);
      return kickSequence ? { scenario, balls: [prepared.ball], kickSequence } : { scenario, balls: [] };
    }
    if (prepared && scenario.curriculum?.learning?.comparison === 'kick-finish') {
      const kickFinish = kickFinishExperiment(scenario, prepared.ball.options);
      return kickFinish ? { scenario, balls: [prepared.ball], kickFinish } : { scenario, balls: [] };
    }
    if (prepared && scenario.curriculum?.learning?.comparison === 'kick-corridor') {
      const kickCorridor = kickCorridorExperiment(scenario, prepared.ball.options);
      return kickCorridor ? { scenario, balls: [prepared.ball], kickCorridor } : { scenario, balls: [] };
    }
    if (prepared && scenario.curriculum?.learning?.comparison === 'kick-spin') {
      const kickSpin = kickSpinExperiment(scenario, prepared.ball.options);
      return kickSpin ? { scenario, balls: [prepared.ball], kickSpin } : { scenario, balls: [] };
    }
    if (prepared && scenario.curriculum?.learning?.comparison === 'kick-pace') {
      const kickPace = kickPaceExperiment(scenario, prepared.ball.options);
      return kickPace ? { scenario, balls: [prepared.ball], kickPace } : { scenario, balls: [] };
    }
    if (prepared && scenario.curriculum?.learning?.comparison === 'kick-contact') {
      const kickContact = prepared.ball.options.map(o => kickContactEvidence(scenario, o.plan,
        simulateShot(scenario, o.plan, { record: false, recordPaths: true })))
        .filter(e => e !== null).sort((a, b) => b.angle - a.angle)[0];
      return kickContact ? { scenario, balls: [prepared.ball], kickContact } : { scenario, balls: [] };
    }
    return { scenario, balls: prepared ? [prepared.ball] : [] };
  }
  if (scenario.objective) {
    const prepared = prepareBall(scenario, scenario.objective.ballId);
    return prepared
      ? { scenario: { ...scenario, objective: { ...scenario.objective, target: prepared.target } }, balls: [prepared.ball], ...(prepared.elongatedPosition ? { elongatedPosition: prepared.elongatedPosition } : {}), ...(prepared.englishRouting ? { englishRouting: prepared.englishRouting } : {}), ...(prepared.corridorCenter ? { corridorCenter: prepared.corridorCenter } : {}), ...(prepared.returnLane ? { returnLane: prepared.returnLane } : {}), ...(prepared.collisionAssistance ? { collisionAssistance: prepared.collisionAssistance } : {}), ...(prepared.pocketChange ? { pocketChange: prepared.pocketChange } : {}), ...(prepared.spareGraze ? { spareGraze: prepared.spareGraze } : {}), ...(prepared.movingTraffic ? { movingTraffic: prepared.movingTraffic } : {}), ...(prepared.fallbackPlan ? { fallbackPlan: prepared.fallbackPlan } : {}), ...(prepared.sequenceComparison ? { sequenceComparison: prepared.sequenceComparison } : {}), ...(prepared.steppingStoneOptionId ? { steppingStoneOptionId: prepared.steppingStoneOptionId } : {}), ...(prepared.zoneExit ? { zoneExit: prepared.zoneExit } : {}), ...(prepared.lookAheadOptionIds ? { lookAheadOptionIds: prepared.lookAheadOptionIds } : {}), ...(prepared.signedAnglePreview ? { signedAnglePreview: prepared.signedAnglePreview } : {}), ...(prepared.contactAccessPocket !== undefined ? { contactAccessPocket: prepared.contactAccessPocket } : {}) }
      : { scenario, balls: [] };
  }
  return { scenario, balls: scenario.balls.filter(ball => ball.id !== 0).flatMap(ball => {
    const prepared = prepareBall(scenario, ball.id);
    return prepared ? [prepared.ball] : [];
  }) };
}

/** Direct search normally tries at most 30 nominal strokes per object ball, or 90 when
 * an authored English lesson compares both side-spin directions with zero. The
 * cut-path, rebound and fixed-pocket comparisons use a denser search (up to
 * 78 strokes for two routes) to preserve
 * their required physical contrast. Return-lane comparisons add draw/follow
 * settings to find two distinct rebound routes. Plant search
 * tries 21 strokes on the fixed pair line, retaining physically simulated misses.
 * Trick search tries 117 strokes on its authored contact line (351 with English),
 * retaining only complete, physically proven tricks before choosing three finishes.
 * Bank search tries 12 routes, nine speeds and five spins with angle calibration.
 * Damaged-table direct shots budget for cloth and cue power, then calibrate
 * fixed cue bias, downhill drift and dirty contacts with up to 15 actual angles.
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
    || (objective.ellipse && (!Number.isFinite(objective.ellipse.longRadius) || objective.ellipse.longRadius <= objective.radius || !Number.isFinite(objective.ellipse.angle)))
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
    const originalCue = attempt > 0 && scenario.conditions && scenario.curriculum ? generateScenario(scenario.level, scenario.seed).balls[0].position : undefined;
    const regeneratedCue = generated.balls[0].position;
    // Regeneration keeps the lesson; plant pockets and trick aim lines follow
    // the regenerated table reflection along with the balls.
    const layout = { ...scenario, seed: generated.seed, balls: generated.balls,
      ...(originalCue && scenario.conditions ? { conditions: reflectTableConditions(scenario.conditions,
        Math.abs(originalCue.x - regeneratedCue.x) > 1e-8, Math.abs(originalCue.y - regeneratedCue.y) > 1e-8) } : {}),
      ...(scenario.curriculum?.learning?.pockets ? { curriculum: { ...scenario.curriculum, learning: { ...scenario.curriculum.learning, pockets: generated.curriculum?.learning?.pockets } } } : {}),
      ...(plant ? { plant: { ...plant, pocketId: generated.plant?.pocketId ?? plant.pocketId } } : {}),
      ...(trick ? { trick: generated.trick ?? trick } : {}) };
    const prepared = prepareLayout(layout);
    if (prepared.balls.length && supportsGeometryComparison(prepared)) {
      if (scenario.curriculum?.learning?.comparison === 'nominated-next-ball') {
        const nextBallNominations = findNominatedBallContrasts(prepared);
        if (nextBallNominations.length >= 2) return { ...prepared, nextBallNominations };
        continue;
      }
      if (scenario.curriculum?.learning?.comparison === 'backward-plan') {
        const backwardPlan = buildBackwardPlan(prepared);
        if (backwardPlan) return { ...prepared, backwardPlan };
        continue;
      }
      if (scenario.curriculum?.learning?.comparison === 'draw-decay') {
        const drawDecay = buildDrawDecayExperiment(prepared);
        if (drawDecay) return { ...prepared, drawDecay };
        continue;
      }
      if (!needsEverydayExperiment(prepared)) return prepared;
      const experiment = buildEverydayExperiment(prepared);
      if (experiment) return { ...prepared, experiment };
    }
  }
  if (options.regenerate === false || scenario.curriculum || objective || bank || plant || trick) throw new Error('No feasible three-finish layout could be prepared for this lesson and its objective.');
  const openLayout: Scenario = { ...scenario, seed: 72350, balls: generateScenario(1, 72350).balls };
  const prepared = prepareLayout(openLayout);
  if (!prepared.balls.length) throw new Error('No feasible three-finish layout could be prepared.');
  return prepared;
}
