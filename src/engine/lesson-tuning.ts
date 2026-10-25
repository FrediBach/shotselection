import type { Scenario } from './types';

/** Defaults for old in-memory scenarios; level files write their relevant values explicitly. */
export const LESSON_TUNING_DEFAULTS = {
  minFinishSeparation: .12,
  minSpeedDifference: .12,
  minSpinDifference: .35,
  maxCandidateSpeed: 3.6,
  expandedSpeeds: Array.from({ length: 16 }, (_, index) => (6 + index * 2) / 10),
  expandedTopSpins: [-1.6, -1.1, -.6, 0, .5, 1.05, 1.6],
  trickSpeeds: [.8, 1, 1.2, 1.4, 1.6, 1.8, 2, 2.25, 2.5, 2.8, 3.1, 3.4, 3.6],
  trickTopSpins: [-1.8, -1.4, -1, -.6, 0, .6, 1.05, 1.5, 2],
  plantSpeedMultipliers: [.8, .95, 1.15, 1.4, 1.7, 2.1, 2.6],
  plantTopSpins: [-1.1, 0, 1.05],
  bankSpeeds: [1.3, 1.6, 1.95, 2.35, 2.8, 3.3, 3.45, 3.6, 3.8],
  bankTopSpins: [-1.1, 0, .5, 1.05, 1.6],
  bankAngleCorrections: [0, -.0005, .0005, -.001, .001, -.0015, .0015, -.002, .002],
  assignmentSpeedMultiplier: 1.04,
  assignmentAngleOffset: .01,
  plantQualityPlantOffset: [.02, 0],
  plantQualityFreeOffset: [.12, -.04],
  playerProfileTargetFraction: .65,
  playerProfileSpeedMultiplier: 1.02,
  defenseSpeedMultiplier: .95,
  defenseTopSpinOffset: -.2,
  continuationSpeedMultiplier: 1.02,
  continuationProbeMultipliers: [.99, 1, 1.01],
  continuationReplySpeeds: [1.8, 1.5, 1.2, .95],
  continuationReplyTopSpins: [0, -.7, 1],
  landingRecoveryPaceMultipliers: [.98, 1.03],
  landingRecoveryReplySpeeds: [.95, 1.2, 1.5, 1.8, 2.1],
  landingRecoveryReplyTopSpins: [0, -.7, 1],
  landingRecoveryMinTargetOffset: .01,
  landingRecoveryMinLeafSeparation: .04,
  landingRecoveryMinCutDifference: 5,
  robustnessClothMultipliers: [.9, 1.1],
  robustnessNapMultipliers: [.8, 1.2],
} satisfies Record<string, number | number[]>;

type TuningKey = keyof typeof LESSON_TUNING_DEFAULTS;
type NumericKey = { [K in TuningKey]: typeof LESSON_TUNING_DEFAULTS[K] extends number ? K : never }[TuningKey];
type ListKey = Exclude<TuningKey, NumericKey>;

export function tuningNumber(scenario: Scenario, key: NumericKey): number {
  const value = scenario.lessonTuning?.[key];
  return typeof value === 'number' ? value : LESSON_TUNING_DEFAULTS[key];
}

export function tuningList(scenario: Scenario, key: ListKey): number[] {
  const value = scenario.lessonTuning?.[key];
  return Array.isArray(value) ? value : LESSON_TUNING_DEFAULTS[key];
}
