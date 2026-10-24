import { distance, dot, normalize, subtract } from './math';
import { TABLE } from './constants';
import { plantIntroductionEvidence } from './plant-introduction';
import { plantLineGeometry } from './plant-line';
import { simulateShot } from './physics';
import type { FinishOption, Scenario, ShotPlan, Simulation } from './types';
export interface PlantDeliveryPreview { referenceId: string; simulation: Simulation }
export function plantDeliveryEvidence(source: Scenario, plan: ShotPlan, simulation: Simulation) {
  const contact = plantIntroductionEvidence(source, plan, simulation), geometry = plantLineGeometry(source);
  if (!contact || !geometry || geometry.outside > 0 || distance(geometry.hit, geometry.pocket.mouthCenter) > .001
    || simulation.contactEvents!.length !== 2 || simulation.cueApproachPath.length < 2) return null;
  const cue = source.balls.find(b => b.id === 0)!.position;
  const incoming = normalize(contact.first.incoming[0]);
  const ghost = { x: geometry.first.x - geometry.direction.x * TABLE.ballDiameter, y: geometry.first.y - geometry.direction.y * TABLE.ballDiameter };
  const deliveryAngle = Math.acos(Math.max(-1, Math.min(1, dot(incoming, geometry.direction)))) * 180 / Math.PI;
  if (!Number.isFinite(deliveryAngle) || deliveryAngle < 30 || deliveryAngle > 80
    || distance(contact.first.positions[0], ghost) > .005
    || distance(contact.first.positions[1], geometry.first) > 1e-9
    || distance(simulation.cueApproachPath[0], cue) > 1e-9
    || distance(simulation.cueApproachPath.at(-1)!, contact.first.positions[0]) > 1e-9
    || dot(normalize(subtract(ghost, cue)), incoming) < .999) return null;
  return { ...contact, geometry, ghost, incoming, deliveryAngle };
}
export function plantDeliveryPreview(source: Scenario, options: FinishOption[]): PlantDeliveryPreview | null {
  for (const option of options) {
    const simulation = simulateShot(source, option.plan, { record: false, recordPaths: true, recordContacts: true });
    if (plantDeliveryEvidence(source, option.plan, simulation)) return { referenceId: option.id, simulation };
  }
  return null;
}
