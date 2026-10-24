import { directShotRoutes } from './objectives';
import { simulateShot } from './physics';
import { secondShotPlan, secondShotPotted } from './second-shot';
import { clamp, distance, seededRandom } from './math';
import { perturbShot } from './stroke-errors';
import { DEFAULT_CHARACTER } from './characters';
import type { CharacterTalents, Scenario, ShotPlan, Simulation } from './types';

export interface SequenceOrder { first: ShotPlan; second: ShotPlan }
export function sequenceLayout(source: Scenario, simulation: Simulation): Scenario {
  return { level: source.level, seed: source.seed, title: 'Two-shot order', description: '', conditions: source.conditions,
    balls: simulation.finalBalls.filter(b => !b.pocketed).map(({ id, position }) => ({ id, position: { ...position } })) };
}

function orderWitnesses(scenario: Scenario, firstId: number, secondId: number, cutLimit: number) {
  const orders = [];
  for (const route of directShotRoutes(scenario.balls, firstId, cutLimit)) {
    for (const pace of [1.2, 1.5, .95]) for (const spin of [0, -.7, 1]) {
      const first = secondShotPlan(scenario, firstId, route, pace, spin);
      const simulation = simulateShot(scenario, first, { record: false });
      if (!secondShotPotted(firstId, simulation)) continue;
      const after = sequenceLayout(scenario, simulation);
      for (const secondRoute of directShotRoutes(after.balls, secondId, cutLimit)) {
        let found = false;
        for (const nextPace of [1.2, 1.5, .95]) {
          const second = secondShotPlan(after, secondId, secondRoute, nextPace, 0);
          if (secondShotPotted(secondId, simulateShot(after, second, { record: false }))) {
            orders.push({ first, second, firstCut: route.cutAngle, secondCut: secondRoute.cutAngle, secondDistance: distance(simulation.cueEnd, secondRoute.ghost) }); found = true; break;
          }
        }
        if (found) break;
      }
    }
  }
  return orders;
}

/** Select on nominal geometry only, before any error ensemble is evaluated. */
export function sequenceWitness(source: Scenario, opening: Simulation) {
  if (!source.objective || !secondShotPotted(1, opening)) return null;
  const scenario = sequenceLayout(source, opening);
  if (source.balls.filter(b => b.id > 1).some(b => {
    const end = scenario.balls.find(e => e.id === b.id);
    return !end || distance(b.position, end.position) > .001;
  })) return null;
  const routes2 = directShotRoutes(scenario.balls, 2, source.objective.maxCutAngle);
  const routes3 = directShotRoutes(scenario.balls, 3, source.objective.maxCutAngle);
  if (!routes2.some(a => routes3.some(b => Math.abs(a.cutAngle - b.cutAngle) >= 8))) return null;
  const a = orderWitnesses(scenario, 2, 3, source.objective.maxCutAngle);
  if (!a.length) return null;
  const b = orderWitnesses(scenario, 3, 2, source.objective.maxCutAngle);
  for (const first of a) for (const second of b) {
    if (Math.abs(first.firstCut - second.firstCut) >= 8 && (Math.abs(first.secondCut - second.secondCut) >= 15 || Math.abs(first.secondDistance - second.secondDistance) >= .4)) return { scenario, orders: [first, second] };
  }
  return null;
}

/** Advance one trial without respotting, swapping pockets or optimizing controls. */
export function sequenceTrial(scenario: Scenario, order: SequenceOrder, cutLimit: number, firstPlan = order.first, secondPlan = order.second) {
  const first = simulateShot(scenario, firstPlan, { record: false });
  const firstLegal = secondShotPotted(order.first.ballId, first);
  const after = sequenceLayout(scenario, first);
  const route = firstLegal ? directShotRoutes(after.balls, order.second.ballId, cutLimit).find(r => r.pocketId === order.second.pocketId) : undefined;
  const adjusted = route ? { ...secondPlan, angle: route.angle + (secondPlan.angle - order.second.angle) } : undefined;
  const second = adjusted ? simulateShot(after, adjusted, { record: false }) : undefined;
  return { first, firstLegal, after, secondPlan: adjusted, second,
    secondAvailable: Boolean(route), completed: Boolean(second && secondShotPotted(order.second.ballId, second)) };
}

/** A trial succeeds only when both simulated pots are legal. Second-shot aim
 * adapts to its fixed pocket from the ACTUAL first finish; pace/spin stay fixed. */
export function analyzeSequences(scenario: Scenario, orders: SequenceOrder[], cutLimit: number, samples = 128, talents: CharacterTalents = DEFAULT_CHARACTER.talents) {
  const count = clamp(Math.floor(samples), 8, 128);
  const results = orders.map(order => {
    const random = seededRandom(scenario.seed ^ 0x61D4B9);
    const firstNominal = simulateShot(scenario, order.first, { record: false, recordPaths: true });
    const secondScenario = sequenceLayout(scenario, firstNominal);
    const secondNominal = simulateShot(secondScenario, order.second, { record: false, recordPaths: true });
    const trials = [];
    for (let i = 0; i < count; i++) {
      // Always draw BOTH error vectors, even when shot one fails. Pair trial i
      // between orders, with separate error draws for the two shot stages.
      const firstPlan = perturbShot(order.first, random, talents);
      const secondPlan = perturbShot(order.second, random, talents);
      const { firstLegal, secondAvailable, completed } = sequenceTrial(scenario, order, cutLimit, firstPlan, secondPlan);
      trials.push({ firstLegal, secondAvailable, completed });
    }
    const firstLegal = trials.filter(t => t.firstLegal).length;
    const secondAvailable = trials.filter(t => t.secondAvailable).length;
    const completed = trials.filter(t => t.completed).length;
    return { order, firstNominal, secondScenario, secondNominal, trials, firstLegal, secondAvailable, completed,
      firstRate: firstLegal / count, continuationRate: firstLegal ? completed / firstLegal : null, completionRate: completed / count };
  });
  return { scenario, cutLimit, samples: count, orders: results };
}
export type SequenceComparison = ReturnType<typeof analyzeSequences>;
