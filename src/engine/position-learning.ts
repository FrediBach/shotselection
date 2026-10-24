import { distance } from './math';
import { directShotGeometry } from './shot-geometry';
import type { Scenario, ShotPlan, Simulation } from './types';

export function contactRollRatio(sim: Simulation): number | null {
  const impact = sim.firstImpact;
  return impact && impact.cueRollSpeedBefore !== undefined && impact.cueSpeedBefore > .05
    ? impact.cueRollSpeedBefore / impact.cueSpeedBefore : null;
}

/** A stop is verified from the actual contact state AND the settled path. */
export function isStopContact(scenario: Scenario, plan: ShotPlan, sim: Simulation) {
  const ratio = contactRollRatio(sim);
  return ratio !== null && Math.abs(ratio) < .15 && directShotGeometry(scenario, plan).cutDegrees < 5
    && distance(sim.firstImpact!.position, sim.cueEnd) < .10
    && sim.ballContacts?.length === 1 && !sim.cueRebounds?.length;
}
export function isRollingContact(scenario: Scenario, plan: ShotPlan, sim: Simulation) {
  const ratio = contactRollRatio(sim);
  return ratio !== null && Math.abs(ratio - 1) < .15 && directShotGeometry(scenario, plan).cutDegrees < 5
    && distance(sim.firstImpact!.position, sim.cueEnd) > .22
    && sim.ballContacts?.length === 1 && !sim.cueRebounds?.length;
}

export function zoneMargin(scenario: Scenario, sim: Simulation) {
  const objective = scenario.objective;
  return objective?.target ? objective.radius - distance(sim.cueEnd, objective.target) : null;
}
