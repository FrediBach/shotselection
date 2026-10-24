import { distance, dot, normalize, subtract } from './math';
import { plantLineGeometry } from './plant-line';
import { plantTargetPotted } from './plant-margin';
import { simulateShot } from './physics';
import type { FinishOption, Scenario, ShotPlan, Simulation } from './types';
export interface PlantDistanceExperiment {
  referenceId: string; degrees: number;
  shortNominal: Simulation; longNominal: Simulation; shortChanged: Simulation; longChanged: Simulation;
}
export function shortenedPlant(source: Scenario) {
  const geometry = plantLineGeometry(source); if (!geometry || !source.plant) return null;
  const shift = { x: (geometry.hit.x - geometry.target.x) * .55, y: (geometry.hit.y - geometry.target.y) * .55 };
  return { shift, scenario: { ...source, balls: source.balls.map(b => [0, source.plant!.ballId, source.plant!.targetBallId].includes(b.id)
    ? { ...b, position: { x: b.position.x + shift.x, y: b.position.y + shift.y } } : b) } };
}
/** Extrapolate the initial recorded target direction, before later jaw/cushion effects. */
export function targetMouthRay(source: Scenario, simulation: Simulation) {
  const g = plantLineGeometry(source), path = simulation.objectPath;
  if (!g || path.length < 2 || distance(path[0], g.target) > 1e-9 || distance(path[0], path[1]) < 1e-6) return null;
  const direction = normalize(subtract(path[1], path[0])), axis = normalize(subtract(g.pocket.mouth[1], g.pocket.mouth[0]));
  const normal = { x: -axis.y, y: axis.x }, denominator = dot(direction, normal);
  if (Math.abs(denominator) < 1e-6) return null;
  const travel = dot(subtract(g.pocket.mouth[0], path[0]), normal) / denominator;
  if (travel <= 0) return null;
  return { direction, travel, hit: { x: path[0].x + direction.x * travel, y: path[0].y + direction.y * travel } };
}
export function plantDistanceEvidence(source: Scenario, plan: ShotPlan, x: PlantDistanceExperiment) {
  const short = shortenedPlant(source), geometry = plantLineGeometry(source);
  if (!short || !geometry || plan.ballId !== source.plant!.ballId || plan.potBallId !== source.plant!.targetBallId || plan.pocketId !== source.plant!.pocketId
    || !Number.isFinite(x.degrees) || Math.abs(x.degrees) < .1 || Math.abs(x.degrees) > 1) return null;
  const a = targetMouthRay(short.scenario, x.shortNominal), b = targetMouthRay(source, x.longNominal);
  const c = targetMouthRay(short.scenario, x.shortChanged), d = targetMouthRay(source, x.longChanged);
  if (!a || !b || !c || !d || distance(a.direction, b.direction) > 1e-7 || distance(c.direction, d.direction) > 1e-7
    || !plantTargetPotted(short.scenario, x.shortNominal) || !plantTargetPotted(source, x.longNominal)
    || !plantTargetPotted(short.scenario, x.shortChanged) || x.longChanged.potted.includes(source.plant!.targetBallId)
    || (x.longChanged.objectCushions ?? 0) < 1 || !x.longChanged.objectPath.some(p => distance(p, geometry.pocket.mouthCenter) < .12)) return null;
  for (const s of [x.shortNominal, x.longNominal, x.shortChanged, x.longChanged]) {
    if (!s.stopped || JSON.stringify(s.ballContacts?.slice(0, 2)) !== '[[0,1],[1,2]]' || !s.contactEvents || s.contactEvents.length < 2
      || s.contactEvents.slice(2).some(event => event.ballIds.some(id => id === 1 || id === 2))
      || s.contactEvents[0].time >= s.contactEvents[1].time) return null;
  }
  // A common translation must preserve the physical delivery in each paired run.
  for (const [s, l] of [[x.shortNominal, x.longNominal], [x.shortChanged, x.longChanged]]) {
    for (let i = 0; i < 2; i++) {
      const se = s.contactEvents![i], le = l.contactEvents![i];
      if (Math.abs(se.time - le.time) > 1e-9) return null;
      for (let j = 0; j < 2; j++) if (distance(se.incoming[j], le.incoming[j]) > 1e-7
        || distance(subtract(se.positions[j], le.positions[j]), short.shift) > 1e-7) return null;
    }
  }
  const shortDrift = distance(a.hit, c.hit), longDrift = distance(b.hit, d.hit);
  const angle = Math.acos(Math.max(-1, Math.min(1, dot(a.direction, c.direction)))) * 180 / Math.PI;
  if (angle < .1 || angle > 5 || shortDrift < .001 || longDrift < .015 || longDrift < shortDrift * 1.5 || b.travel < a.travel * 1.5) return null;
  return { short: short.scenario, shift: short.shift, geometry, shortNominal: a, longNominal: b, shortChanged: c, longChanged: d, shortDrift, longDrift, angle };
}
export function plantDistanceExperiment(source: Scenario, options: FinishOption[]): PlantDistanceExperiment | null {
  const short = shortenedPlant(source); if (!short) return null;
  const flags = { record: false, recordPaths: true, recordContacts: true };
  for (const option of options) {
    const shortNominal = simulateShot(short.scenario, option.plan, flags), longNominal = simulateShot(source, option.plan, flags);
    for (const degrees of [.25, -.25, .5, -.5, .75, -.75]) {
      const plan = { ...option.plan, angle: option.plan.angle + degrees * Math.PI / 180 };
      const x = { referenceId: option.id, degrees, shortNominal, longNominal,
        shortChanged: simulateShot(short.scenario, plan, flags), longChanged: simulateShot(source, plan, flags) };
      if (plantDistanceEvidence(source, option.plan, x)) return x;
    }
  }
  return null;
}
