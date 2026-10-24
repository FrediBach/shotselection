import { distance, dot, normalize, subtract } from './math';
import { plantLineGeometry } from './plant-line';
import { plantTargetPotted } from './plant-margin';
import { simulateShot } from './physics';
import type { FinishOption, Scenario, ShotPlan, Simulation, Vec2 } from './types';
export interface PlantThrowExperiment { referenceId: string; actual: Simulation; frictionless: Simulation }
const angle = (a: Vec2, b: Vec2) => Math.acos(Math.max(-1, Math.min(1, dot(normalize(a), normalize(b))))) * 180 / Math.PI;
export function plantThrowEvidence(source: Scenario, plan: ShotPlan, x: PlantThrowExperiment) {
  const geometry = plantLineGeometry(source);
  if (!geometry || !source.plant || distance(geometry.hit, geometry.pocket.mouthCenter) > .001
    || plan.ballId !== source.plant.ballId || plan.potBallId !== source.plant.targetBallId || plan.pocketId !== source.plant.pocketId) return null;
  for (const s of [x.actual, x.frictionless]) {
    if (!plantTargetPotted(source, s) || JSON.stringify(s.ballContacts) !== '[[0,1],[1,2]]' || s.contactEvents?.length !== 2
      || s.contactEvents[0].time >= s.contactEvents[1].time || !s.contactEvents[1].outgoing
      || !s.objectPath.length || distance(s.objectPath[0], geometry.target) > 1e-9) return null;
  }
  const [first, transfer] = x.actual.contactEvents!, [controlFirst, controlTransfer] = x.frictionless.contactEvents!;
  for (const [a, b] of [[first, controlFirst], [transfer, controlTransfer]]) {
    if (Math.abs(a.time - b.time) > 1e-9) return null;
    for (let i = 0; i < 2; i++) if (distance(a.positions[i], b.positions[i]) > 1e-9 || distance(a.incoming[i], b.incoming[i]) > 1e-9) return null;
  }
  if (!first.outgoing || !controlFirst.outgoing || first.outgoing.some((v, i) => distance(v, controlFirst.outgoing![i]) > 1e-9)
    || Math.hypot(transfer.incoming[1].x, transfer.incoming[1].y) > 1e-8
    || distance(transfer.positions[1], geometry.target) > 1e-9 || transfer.pottedBefore.includes(source.plant.targetBallId)) return null;
  const normal = normalize(subtract(transfer.positions[1], transfer.positions[0]));
  const outgoing = normalize(transfer.outgoing![1]), control = normalize(controlTransfer.outgoing![1]);
  const oblique = angle(transfer.incoming[0], normal), throwAngle = angle(normal, outgoing), controlAngle = angle(normal, control);
  if (Math.hypot(transfer.outgoing![1].x, transfer.outgoing![1].y) < .05 || oblique < 5 || oblique > 60
    || throwAngle < .25 || throwAngle > 5 || controlAngle > .01) return null;
  const axis = normalize(subtract(geometry.pocket.mouth[1], geometry.pocket.mouth[0])), mouthNormal = { x: -axis.y, y: axis.x };
  const project = (direction: Vec2) => {
    const t = dot(subtract(geometry.pocket.mouth[0], geometry.target), mouthNormal) / dot(direction, mouthNormal);
    return t > 0 && Number.isFinite(t) ? { x: geometry.target.x + direction.x * t, y: geometry.target.y + direction.y * t } : null;
  };
  const actualHit = project(outgoing), controlHit = project(control);
  if (!actualHit || !controlHit || distance(actualHit, controlHit) < .002) return null;
  return { geometry, first, transfer, normal, outgoing, control, oblique, throwAngle, controlAngle, actualHit, controlHit,
    deliveryAngle: angle(geometry.direction, normal), mouthShift: distance(actualHit, controlHit) };
}
export function plantThrowExperiment(source: Scenario, options: FinishOption[]): PlantThrowExperiment | null {
  for (const option of options) {
    const flags = { record: false, recordPaths: true, recordContacts: true };
    const x = { referenceId: option.id, actual: simulateShot(source, option.plan, flags),
      frictionless: simulateShot(source, option.plan, { ...flags, disablePlantTransferFriction: true }) };
    if (plantThrowEvidence(source, option.plan, x)) return x;
  }
  return null;
}
