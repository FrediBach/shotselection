import { directNextShotRoutes, plannedMovementOutcome } from './objectives';
import { simulateShot } from './physics';
import { secondShotPlan, secondShotPotted } from './second-shot';
import { directReplyPotted } from './defensive-outcome';
import type { Opening } from './look-ahead';
import type { Scenario } from './types';

export function plannedMovementEvidence(source: Scenario, opening: Opening) {
  if (!source.objective || !source.plannedMovement || !secondShotPotted(source.objective.ballId, opening.simulation)
    || !plannedMovementOutcome(source, opening.simulation).opened) return null;
  const scenario = { ...source, balls: opening.simulation.finalBalls.filter(b => !b.pocketed).map(({ id, position }) => ({ id, position: { ...position } })) };
  const blocker = source.balls.find(b => b.id === source.plannedMovement!.blockerId)!;
  const restored: Scenario = { ...scenario, balls: scenario.balls.map(b => b.id === blocker.id ? structuredClone(blocker) : b) };
  for (const route of directNextShotRoutes(source, opening.simulation)) {
    for (const pace of [.95, 1.2, 1.5]) for (const spin of [0, -.7, 1]) {
      const plan = secondShotPlan(scenario, source.objective.nextBallId, route, pace, spin);
      const simulation = simulateShot(scenario, plan, { record: false, recordPaths: true });
      if (!directReplyPotted(plan, simulation)) continue;
      const blocked = simulateShot(restored, plan, { record: false, recordPaths: true });
      if (blocked.firstContact !== blocker.id || secondShotPotted(plan.ballId, blocked)) continue;
      return { opening, scenario, restored, plan, simulation, blocked, route };
    }
  }
  return null;
}
