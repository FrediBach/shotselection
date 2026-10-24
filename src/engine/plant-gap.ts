import { TABLE } from './constants';
import { distance } from './math';
import { plantTargetPotted } from './plant-margin';
import { simulateShot } from './physics';
import type { FinishOption, Scenario, ShotPlan, Simulation } from './types';
export interface PlantGapPreview { referenceId: string; simulation: Simulation }
export function plantGapEvidence(source: Scenario, plan: ShotPlan, s: Simulation) {
  const plant = source.plant, events = s.contactEvents, path = s.plantTransferPath;
  const firstBall = source.balls.find(b => b.id === plant?.ballId), targetBall = source.balls.find(b => b.id === plant?.targetBallId);
  if (!plant || !firstBall || !targetBall || !events || events.length < 2 || !path || path.length < 4
    || !plantTargetPotted(source, s) || plan.ballId !== plant.ballId || plan.potBallId !== plant.targetBallId || plan.pocketId !== plant.pocketId
    || events[0].ballIds.join(',') !== '0,1' || events[1].ballIds.join(',') !== '1,2' || events[0].time >= events[1].time
    || events[1].pottedBefore.includes(plant.targetBallId)) return null;
  const [first, transfer] = events;
  const spacing = distance(firstBall.position, targetBall.position), gap = spacing - TABLE.ballDiameter;
  const travel = path.slice(1).reduce((sum, p, i) => sum + distance(path[i], p), 0);
  if (spacing < .11 || spacing > .16 || travel < .045 || travel > .15
    || distance(path[0], firstBall.position) > 1e-9 || distance(path[0], first.positions[1]) > 1e-9
    || distance(path.at(-1)!, transfer.positions[0]) > 1e-9 || distance(transfer.positions[1], targetBall.position) > 1e-9
    || Math.hypot(transfer.incoming[1].x, transfer.incoming[1].y) > 1e-8
    || !s.objectPath.length || distance(s.objectPath[0], targetBall.position) > 1e-9
    || path.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y))) return null;
  return { first, transfer, path, spacing, gap, travel, duration: transfer.time - first.time, firstBall, targetBall };
}
export function plantGapPreview(source: Scenario, options: FinishOption[]): PlantGapPreview | null {
  for (const option of options) {
    const simulation = simulateShot(source, option.plan, { record: false, recordPaths: true, recordContacts: true, recordPlantTransfer: true });
    if (plantGapEvidence(source, option.plan, simulation)) return { referenceId: option.id, simulation };
  }
  return null;
}
