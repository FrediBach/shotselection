import { distance } from './math';
import { simulateShot } from './physics';
import { POCKET_GEOMETRY } from './table-geometry';
import type { FinishOption, Scenario, ShotPlan, Simulation } from './types';
export interface PlantIntroductionPreview { referenceId: string; simulation: Simulation }
export function plantIntroductionEvidence(source: Scenario, plan: ShotPlan, s: Simulation) {
  const plant = source.plant, events = s.contactEvents;
  if (!plant || !events || events.length < 2 || !s.stopped || s.scratch || s.firstContact !== plant.ballId
    || plan.ballId !== plant.ballId || plan.potBallId !== plant.targetBallId || plan.pocketId !== plant.pocketId
    || !s.potted.includes(plant.targetBallId)) return null;
  const [first, transfer] = events, pair = [plant.ballId, plant.targetBallId].sort((a, b) => a - b);
  if (first.ballIds[0] !== 0 || first.ballIds[1] !== plant.ballId || transfer.ballIds[0] !== pair[0] || transfer.ballIds[1] !== pair[1]
    || first.time >= transfer.time || !s.firstImpact || Math.abs(first.time - s.firstImpact.time) > 1e-9
    || distance(first.positions[0], s.firstImpact.position) > 1e-9 || transfer.pottedBefore.includes(plant.targetBallId)) return null;
  const firstIndex = transfer.ballIds.indexOf(plant.ballId), targetIndex = transfer.ballIds.indexOf(plant.targetBallId);
  const speed = (v: { x: number; y: number }) => Math.hypot(v.x, v.y);
  if (speed(first.incoming[0]) < .05 || speed(first.incoming[1]) > .01 || speed(transfer.incoming[firstIndex]) < .05 || speed(transfer.incoming[targetIndex]) > .01) return null;
  const pocket = POCKET_GEOMETRY.find(p => p.id === plant.pocketId), target = source.balls.find(b => b.id === plant.targetBallId);
  if (!pocket || !target || !s.objectPath.length || distance(s.objectPath[0], target.position) > 1e-9
    || distance(s.objectPath.at(-1)!, pocket.center) > .08 || s.objectCushions !== 0) return null;
  return { first, transfer, pocket, firstIndex, targetIndex };
}
export function plantIntroductionPreview(source: Scenario, options: FinishOption[]): PlantIntroductionPreview | null {
  for (const option of options) {
    const simulation = simulateShot(source, option.plan, { record: false, recordPaths: true, recordContacts: true });
    if (plantIntroductionEvidence(source, option.plan, simulation)) return { referenceId: option.id, simulation };
  }
  return null;
}
