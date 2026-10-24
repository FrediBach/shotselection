import { TABLE } from './constants';
import { distance, dot, normalize, subtract } from './math';
import { POCKET_GEOMETRY } from './table-geometry';
import { simulateShot } from './physics';
import type { FinishOption, Scenario, ShotPlan, Simulation } from './types';
export interface PlantLinePreview { referenceId: string; simulation: Simulation }
/** Intersect the initial pair-center ray with the infinite pocket-mouth line. */
export function plantLineGeometry(source: Scenario) {
  const plant = source.plant;
  const first = source.balls.find(b => b.id === plant?.ballId), target = source.balls.find(b => b.id === plant?.targetBallId);
  const pocket = POCKET_GEOMETRY.find(p => p.id === plant?.pocketId);
  if (!plant || !first || !target || !pocket || distance(first.position, target.position) < TABLE.ballDiameter - 1e-6) return null;
  const direction = normalize(subtract(target.position, first.position)), axis = normalize(subtract(pocket.mouth[1], pocket.mouth[0]));
  const normal = { x: -axis.y, y: axis.x }, denominator = dot(direction, normal);
  if (Math.abs(denominator) < 1e-9) return null;
  const travel = dot(subtract(pocket.mouth[0], target.position), normal) / denominator;
  if (travel <= 0) return null;
  const hit = { x: target.position.x + direction.x * travel, y: target.position.y + direction.y * travel };
  const width = distance(...pocket.mouth), along = dot(subtract(hit, pocket.mouth[0]), axis);
  const outside = Math.max(-along, along - width, 0), edge = along < 0 ? pocket.mouth[0] : pocket.mouth[1];
  return { first: first.position, target: target.position, pocket, direction, hit, width, along, outside, edge };
}
export function plantLineEvidence(source: Scenario, plan: ShotPlan, s: Simulation) {
  const geometry = plantLineGeometry(source), plant = source.plant, events = s.contactEvents;
  if (!geometry || !plant || geometry.outside < .005 || !s.stopped || s.scratch || s.potted.includes(plant.targetBallId)
    || s.firstContact !== plant.ballId || plan.ballId !== plant.ballId || plan.potBallId !== plant.targetBallId || plan.pocketId !== plant.pocketId
    || !events || events.length < 2 || events[0].ballIds[0] !== 0 || events[0].ballIds[1] !== plant.ballId
    || events[1].ballIds[0] !== Math.min(plant.ballId, plant.targetBallId) || events[1].ballIds[1] !== Math.max(plant.ballId, plant.targetBallId)
    || events[0].time >= events[1].time || events[1].pottedBefore.includes(plant.targetBallId)
    || !s.objectPath.length || distance(s.objectPath[0], geometry.target) > 1e-9 || !s.objectCushions
    || Math.min(...s.objectPath.map(p => distance(p, geometry.pocket.mouthCenter))) > .12) return null;
  return { ...geometry, firstContact: events[0], transfer: events[1] };
}
export function plantLinePreview(source: Scenario, options: FinishOption[]): PlantLinePreview | null {
  for (const option of options) {
    const simulation = simulateShot(source, option.plan, { record: false, recordPaths: true, recordContacts: true });
    if (plantLineEvidence(source, option.plan, simulation)) return { referenceId: option.id, simulation };
  }
  return null;
}
