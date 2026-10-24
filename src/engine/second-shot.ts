import { directShotRoutes } from './objectives';
import type { DirectShotRoute } from './objectives';
import type { Scenario, ShotPlan, Simulation } from './types';

/** Carry the selected nominal opener forward without regenerating or respotting. */
export function secondShotSetup(source: Scenario, plan: ShotPlan, simulation: Simulation) {
  const objective = source.objective;
  const ballId = objective?.nextBallId ?? 2;
  const scenario: Scenario = {
    level: source.level, seed: source.seed, title: 'Play the second shot',
    description: 'The first finish is now your starting position.',
    conditions: source.conditions,
    balls: simulation.finalBalls.filter(ball => !ball.pocketed).map(ball => ({ id: ball.id, position: { ...ball.position } })),
  };
  let reason = '';
  if (!simulation.stopped) reason = 'The opening shot did not settle. There is no settled starting state to play from.';
  else if (simulation.scratch || !scenario.balls.some(ball => ball.id === 0)) reason = 'The opener scratched. This sequence ends here; the cue ball is not respotted.';
  else if (!objective || plan.ballId !== objective.ballId || simulation.firstContact !== objective.ballId || !simulation.potted.includes(objective.ballId)) reason = 'The opener did not legally pot ball 1. This two-pot sequence ends here.';
  else if (!scenario.balls.some(ball => ball.id === ballId)) reason = `Ball ${ballId} was already potted. It cannot be played as the second shot.`;
  const routes = reason ? [] : directShotRoutes(scenario.balls, ballId, objective!.maxCutAngle);
  if (!reason && !routes.length) reason = `No clear direct route to ball ${ballId} remains within the ${objective!.maxCutAngle}° cut limit. The opening finish has lost the connection.`;
  return { scenario, ballId, routes, reason };
}

export function secondShotPlan(scenario: Scenario, ballId: number, route: DirectShotRoute, multiplier: number, topSpin: number): ShotPlan {
  return {
    id: `second-${ballId}-${route.pocketId}-${multiplier}-${topSpin}`, ballId, pocketId: route.pocketId,
    target: { ...scenario.balls.find(ball => ball.id === 0)!.position },
    angle: route.angle, speed: Math.min(3.6, route.speed * multiplier), topSpin, sideSpin: 0,
    label: 'Second shot',
  };
}

export function secondShotPotted(ballId: number, simulation: Simulation) {
  return simulation.stopped && !simulation.scratch && simulation.firstContact === ballId && simulation.potted.includes(ballId);
}
