import { directShotRoutes } from './objectives';
import { distance } from './math';
import { simulateShot } from './physics';
import { secondShotPlan, secondShotPotted } from './second-shot';
import type { Scenario, ShotPlan, Simulation } from './types';

/** “Easy” here means a clear direct route with at most this cut, not a probability. */
export const KEY_BALL_TARGET_CUT = 35;

function settledLayout(source: Scenario, sim: Simulation): Scenario {
  return { level: source.level, seed: source.seed, title: 'Key-ball continuation', description: '', conditions: source.conditions,
    balls: sim.finalBalls.filter(ball => !ball.pocketed).map(({ id, position }) => ({ id, position: { ...position } })) };
}

/** A bounded, reproducible witness for 2 → 3, never a claim of exhaustive search. */
export function keyBallContinuation(source: Scenario, first: Simulation) {
  if (!first.stopped || first.scratch) return null;
  const scenario = settledLayout(source, first);
  for (const route of directShotRoutes(scenario.balls, 2, source.objective!.maxCutAngle)) {
    for (const pace of [.95, 1.2, 1.5]) for (const spin of [0, -.7, 1]) {
      const plan = secondShotPlan(scenario, 2, route, pace, spin);
      const simulation = simulateShot(scenario, plan, { record: false, recordPaths: true });
      if (!secondShotPotted(2, simulation)) continue;
      const thirdScenario = settledLayout(scenario, simulation);
      for (const thirdRoute of directShotRoutes(thirdScenario.balls, 3, KEY_BALL_TARGET_CUT)) {
        for (const thirdPace of [.95, 1.2, 1.5]) {
          const thirdPlan = secondShotPlan(thirdScenario, 3, thirdRoute, thirdPace, 0);
          const thirdSimulation = simulateShot(thirdScenario, thirdPlan, { record: false, recordPaths: true });
          if (secondShotPotted(3, thirdSimulation)) return { scenario, plan, simulation, thirdScenario, thirdPlan, thirdSimulation, thirdCut: thirdRoute.cutAngle };
        }
      }
    }
  }
  return null;
}

export function keyBallEvidence(source: Scenario, plan: ShotPlan, first: Simulation) {
  const legalPot = plan.ballId === 1 && secondShotPotted(1, first);
  const key = first.finalBalls.find(ball => ball.id === 2 && !ball.pocketed);
  const start = source.balls.find(ball => ball.id === 2)!;
  const moved = key ? distance(start.position, key.position) : null;
  const balls = first.finalBalls.filter(ball => !ball.pocketed);
  const targetRemaining = balls.some(ball => ball.id === 3);
  const keyRoutes = legalPot && key ? directShotRoutes(balls, 2, source.objective!.maxCutAngle) : [];
  const directTargetRoutes = legalPot && targetRemaining ? directShotRoutes(balls, 3, KEY_BALL_TARGET_CUT) : [];
  const eligible = legalPot && targetRemaining && !directTargetRoutes.length;
  const continuation = eligible && moved !== null && moved < .001 && keyRoutes.length ? keyBallContinuation(source, first) : null;
  // Restore only ball 2. The cue, third target and all other settled balls stay fixed.
  const restored = eligible && moved !== null && moved > .15 && !keyRoutes.length
    ? { ...first, finalBalls: first.finalBalls.map(ball => ball.id === 2 ? { ...ball, position: { ...start.position } } : ball) } : null;
  const restoration = restored ? keyBallContinuation(source, restored) : null;
  return { legalPot, moved, keyRoutes, directTargetRoutes, continuation, restoration,
    kept: Boolean(continuation), lost: Boolean(restoration) };
}
