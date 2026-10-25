import { normalize, subtract } from './math';
import { tuningList } from './lesson-tuning';
import type { BallFinishOptions, Scenario, ShotAnalysis } from './types';
/** Fixed finish requirements in the plant's local frame; never fitted to a live sample. */
export function authorPlantQualityTargets(source: Scenario, balls: BallFinishOptions[]): BallFinishOptions[] {
  const plant = source.plant!;
  const direction = normalize(subtract(source.balls.find(b => b.id === plant.targetBallId)!.position, source.balls.find(b => b.id === plant.ballId)!.position));
  const tangent = { x: -direction.y, y: direction.x };
  return balls.map(ball => ({ ...ball, options: ball.options.map(option => {
    if (option.label !== 'C') return option;
    const [across, along] = tuningList(source, ball.ballId === plant.ballId ? 'plantQualityPlantOffset' : 'plantQualityFreeOffset');
    return { ...option, plan: { ...option.plan, target: {
      x: option.plan.target.x + across * tangent.x + along * direction.x,
      y: option.plan.target.y + across * tangent.y + along * direction.y,
    } } };
  }) as BallFinishOptions['options'] }));
}
export function plantQualitySummary(shot: ShotAnalysis) {
  const credits = shot.trialTargetCredits, flags = shot.trialSuccesses;
  if (!credits || !flags || !shot.samples || credits.length !== shot.samples || flags.length !== shot.samples
    || credits.some(c => !Number.isFinite(c) || c < 0 || c > 1)) return null;
  const successes = flags.filter(Boolean).length;
  const quality = credits.reduce((sum, c) => sum + c, 0) / shot.samples;
  const components = [shot.successRate * .72, quality * .20, shot.legalPotRate * .08];
  if (Math.abs(successes / shot.samples - shot.successRate) > 1e-9 || Math.abs(quality - shot.targetQuality) > 1e-9
    || Math.abs(components.reduce((a, b) => a + b, 0) - shot.score) > 1e-9) return null;
  return { successes, components, conditional: successes ? credits.reduce((sum, c, i) => sum + (flags[i] ? c : 0), 0) / successes : null };
}
export function qualityWinner(plant: number, free: number): string {
  return Math.abs(plant - free) < 1e-9 ? 'Tie' : plant > free ? 'Plant C' : 'Free-ball C';
}
