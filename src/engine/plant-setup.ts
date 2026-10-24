import { normalize, subtract } from './math';
import type { Scenario, ShotAnalysis } from './types';
export type PlantSetupShot = Pick<ShotAnalysis, 'plan' | 'score' | 'successRate' | 'samples'>;
/** Move only ball 1 by 2 mm perpendicular to the initial pair direction. */
export function shiftedPlantSetup(source: Scenario): Scenario {
  const plant = source.plant!;
  const first = source.balls.find(b => b.id === plant.ballId)!, target = source.balls.find(b => b.id === plant.targetBallId)!;
  const direction = normalize(subtract(target.position, first.position));
  return { ...source, balls: source.balls.map(b => b.id === first.id ? { ...b, position: {
    x: b.position.x - direction.y * .002, y: b.position.y + direction.x * .002,
  } } : b) };
}
export function setupRoute(shots: PlantSetupShot[], plantId: number): 'Plant' | 'Free ball' | 'Tie' | null {
  const plant = shots.filter(s => s.plan.ballId === plantId), free = shots.filter(s => s.plan.ballId !== plantId);
  if (!plant.length || !free.length || shots.some(s => !Number.isFinite(s.score))) return null;
  const delta = Math.max(...plant.map(s => s.score)) - Math.max(...free.map(s => s.score));
  return Math.abs(delta) < 1e-9 ? 'Tie' : delta > 0 ? 'Plant' : 'Free ball';
}
export function setupComparison(a: PlantSetupShot[], b: PlantSetupShot[], plantId: number) {
  const before = setupRoute(a, plantId), after = setupRoute(b, plantId);
  if (!before || !after || a.length !== b.length || a.some(s => !b.some(t => t.plan.id === s.plan.id && t.samples === s.samples))) return null;
  return { before, after, outcome: before === 'Tie' || after === 'Tie' ? 'tie' : before === after ? 'same' : 'flip' };
}
