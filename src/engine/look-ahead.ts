import { directShotRoutes } from './objectives';
import { simulateShot } from './physics';
import { secondShotPlan, secondShotPotted } from './second-shot';
import { distance } from './math';
import type { Scenario, ShotPlan, Simulation } from './types';

export const LOOK_AHEAD_CUT = 35;
export interface Opening { plan: ShotPlan; simulation: Simulation }
function layout(source: Scenario, sim: Simulation): Scenario {
  return { level: source.level, seed: source.seed, title: 'Look ahead to ball 3', description: '', conditions: source.conditions,
    balls: sim.finalBalls.filter(b => !b.pocketed).map(({ id, position }) => ({ id, position: { ...position } })) };
}
/** Matched follow-up settings isolate the consequence of the first cue finish. */
export function lookAheadTrials(source: Scenario, opening: Opening) {
  if (!secondShotPotted(1, opening.simulation) || opening.plan.ballId !== 1) return [];
  if (source.balls.filter(b => b.id > 1).some(b => {
    const end = opening.simulation.finalBalls.find(e => e.id === b.id && !e.pocketed);
    return !end || distance(b.position, end.position) > .001;
  })) return [];
  const scenario = layout(source, opening.simulation);
  const trials = [];
  for (const route of directShotRoutes(scenario.balls, 2, source.objective!.maxCutAngle)) {
    for (const speed of [1, 1.4, 1.8, 2.2]) for (const topSpin of [0, -.7, 1]) {
      const plan = { ...secondShotPlan(scenario, 2, route, 1, topSpin), speed };
      const simulation = simulateShot(scenario, plan, { record: false, recordPaths: true });
      if (!secondShotPotted(2, simulation) || !simulation.finalBalls.some(b => b.id === 3 && !b.pocketed)) continue;
      const thirdScenario = layout(scenario, simulation);
      const routes = directShotRoutes(thirdScenario.balls, 3, LOOK_AHEAD_CUT);
      trials.push({ scenario, plan, simulation, thirdScenario, routes });
    }
  }
  return trials;
}

export function lookAheadPairFinder(source: Scenario) {
  const cache = new Map<Opening, ReturnType<typeof lookAheadTrials>>();
  const trials = (entry: Opening) => {
    if (!cache.has(entry)) cache.set(entry, lookAheadTrials(source, entry));
    return cache.get(entry)!;
  };
  return (entries: Opening[]) => {
    for (const a of entries) for (const b of entries) {
      if (a === b || a.plan.pocketId !== b.plan.pocketId || Math.max(a.plan.speed, b.plan.speed) / Math.min(a.plan.speed, b.plan.speed) > 1.7) continue;
      const gap = distance(a.simulation.cueEnd, b.simulation.cueEnd);
      if (gap < .12 || gap > source.objective!.radius * 1.9) continue;
      const target = { x: (a.simulation.cueEnd.x + b.simulation.cueEnd.x) / 2, y: (a.simulation.cueEnd.y + b.simulation.cueEnd.y) / 2 };
      if (source.objective!.target && [a, b].some(e => distance(e.simulation.cueEnd, source.objective!.target!) > source.objective!.radius)) continue;
      for (const lost of trials(a).filter(t => !t.routes.length)) for (const kept of trials(b).filter(t => t.routes.length)) {
        if (lost.plan.pocketId !== kept.plan.pocketId || lost.plan.speed !== kept.plan.speed || lost.plan.topSpin !== kept.plan.topSpin) continue;
        for (const route of kept.routes) for (const pace of [.95, 1.2, 1.5]) {
          const thirdPlan = secondShotPlan(kept.thirdScenario, 3, route, pace, 0);
          const third = simulateShot(kept.thirdScenario, thirdPlan, { record: false, recordPaths: true });
          if (secondShotPotted(3, third)) return { lost: { opening: a, ...lost }, kept: { opening: b, ...kept }, target: source.objective!.target ?? target, thirdPlan, third, thirdCut: route.cutAngle };
        }
      }
    }
    return null;
  };
}
