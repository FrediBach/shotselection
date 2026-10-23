import type { RoundScore } from './scoring';

/** Stroke consistency from 0 (least precise) to 100 (most precise). */
export interface CharacterTalents {
  anglePrecision: number;
  englishPrecision: number;
  strengthPrecision: number;
  spinPrecision: number;
}
export interface PlayerCharacter {
  id: string;
  name: string;
  talents: CharacterTalents;
}

/** All positions are in metres; x: 0..2.54, y: 0..1.27; cue ball id is 0. */
export interface Vec2 { x: number; y: number }
export interface Ball { id: number; position: Vec2 }
export interface Pocket { id: number; name: string; position: Vec2; kind: 'corner' | 'side' }
export interface LessonBriefing {
  stage: 'introduce' | 'develop' | 'apply';
  focus: string;
  gotcha: string;
}
export interface CurriculumLesson {
  chapterId: string;
  chapterTitle: string;
  chapterIndex: number;
  lessonIndex: number;
  lessonCount: number;
  /** Offer one English stroke alongside two without it; magnitude in rad/s. */
  englishPractice?: number;
  lesson: string;
  takeaway: string;
  /** Pre-level coaching, progressing from introduction to independent practice. */
  briefing?: LessonBriefing;
}
export interface PositionObjective {
  kind: 'position';
  ballId: number;
  nextBallId: number;
  /** Shared landing-zone radius in metres, independent of the offered stroke. */
  radius: number;
  /** Largest acceptable direct next-ball cut, in degrees. */
  maxCutAngle: number;
  /** Assigned during preparation when the lesson does not specify a fixed zone. */
  target?: Vec2;
}
export interface Scenario {
  level: number;
  seed: number;
  title: string;
  description: string;
  balls: Ball[];
  curriculum?: CurriculumLesson;
  objective?: PositionObjective;
  /** Cue-ball cushions required before the first contact with this object ball. */
  bank?: { ballId: number; minCushions: number };
  /** Contact the first ball to send its paired target towards this pocket. */
  plant?: { ballId: number; targetBallId: number; pocketId: number };
}
export interface Selection { ballId: number; optionId: string }
export interface ShotPlan {
  id: string;
  /** Ball selected by the player and required at the cue ball's first contact. */
  ballId: number;
  /** Ball to pot; defaults to the first-contact ball for ordinary shots. */
  potBallId?: number;
  pocketId: number;
  target: Vec2;
  angle: number;
  speed: number;
  /** Initial longitudinal spin as a fraction of natural rolling spin. */
  topSpin: number;
  /** Initial vertical spin in radians/second. */
  sideSpin: number;
  label: string;
}
export interface FinishOption {
  id: string;
  label: 'A' | 'B' | 'C';
  plan: ShotPlan;
  /** Nominal cue-ball route, ending at its first object-ball contact. */
  cueApproachPath: Vec2[];
}
export interface BallFinishOptions {
  ballId: number;
  options: [FinishOption, FinishOption, FinishOption];
}
export interface PreparedRound {
  /** Can differ from the input if a blocked layout required regeneration. */
  scenario: Scenario;
  /** Balls absent from this list remain on the table but are not selectable. */
  balls: BallFinishOptions[];
}
export interface SimulationBall extends Ball { pocketed: boolean }
export interface SimulationFrame { time: number; balls: SimulationBall[] }
export interface SimulationSoundEvent {
  type: 'cue' | 'ball' | 'cushion' | 'pocket';
  /** Time in simulation seconds, shared with replay frames. */
  time: number;
  /** Impact strength normalized to [0, 1]. */
  strength: number;
}
export interface Simulation {
  frames: SimulationFrame[];
  /** Exact final state of every ball, even when replay recording is disabled. */
  finalBalls: SimulationBall[];
  /** Physical impacts for full replays; empty for ensemble trials. */
  soundEvents: SimulationSoundEvent[];
  cuePath: Vec2[];
  /** Cue-ball route through the first contact, including exact cushion turns. */
  cueApproachPath: Vec2[];
  /** Actual trajectory of plan.potBallId (or plan.ballId for a direct shot). */
  objectPath: Vec2[];
  cueEnd: Vec2;
  potted: number[];
  scratch: boolean;
  firstContact: number | null;
  /** Actual cue-ball rebounds before its first object-ball contact. */
  cueBanksBeforeContact?: number;
  duration: number;
  /** True only when all unpocketed balls have settled before the time limit. */
  stopped: boolean;
}
export interface ShotAnalysis {
  plan: ShotPlan;
  successRate: number;
  potRate: number;
  /** Settled pots satisfying contact/route rules without scratching. */
  legalPotRate: number;
  /** Mean target-closeness credit; zero for illegal pots or unavailable next shots. */
  targetQuality: number;
  scratchRate: number;
  positionRate: number;
  /** Trials leaving the reserved ball a clear direct route within the lesson's cut limit. */
  nextShotRate?: number;
  /** RMS cue-ball endpoint spread in metres. */
  spread: number;
  meanEnd: Vec2;
  samplePaths: Vec2[][];
  /** All trial object-ball paths, in the same trial order as samplePaths. */
  sampleObjectPaths: ObjectBallTrial[];
  sampleEnds: Vec2[];
  /** Every ball's final state for every trial, in sampleObjectPaths trial order. */
  sampleBallEnds: SimulationBall[][];
  /** Robust utility in [0,1], based on actual ensemble outcomes. */
  score: number;
  nominal: Simulation;
  samples: number;
  explanation: string;
}
export interface ObjectBallTrial {
  path: Vec2[];
  /** A pot requires correct first contact; scratch is a separate cue-ball event. */
  outcome: 'pot' | 'miss' | 'foul';
}
export interface RoundAnalysis {
  candidates: ShotAnalysis[];
  selected: ShotAnalysis;
  best: ShotAnalysis;
  points: RoundScore['points'];
  scoring: RoundScore;
  samples: number;
  positionTolerance: number;
}
export interface AnalyzeOptions { samples?: number; talents?: CharacterTalents }
/** Deltas from the fixed nominal stroke: degrees, rad/s, and percent of speed. */
export type ToleranceAxis = 'angle' | 'sideSpin' | 'speed';
export interface ToleranceBound {
  /** Nonnegative size of a one-sided deviation, in the axis's public units. */
  value: number;
  /** Still passes at the search limit (or physical speed limit). */
  limited: boolean;
}
export interface ToleranceRange { negative: ToleranceBound; positive: ToleranceBound }
export interface AxisTolerance { pot: ToleranceRange; success: ToleranceRange }
export interface TolerancePoint {
  /** Degrees: negative is left, positive is right, relative to the cue direction. */
  angle: number;
  /** Radians/second: positive adds left english, negative adds right english. */
  sideSpin: number;
  /** Percentage change from nominal cue speed. */
  speed: number;
  /** False when requested cue speed is outside the simulator's physical range. */
  available: boolean;
  success: boolean;
  /** A settled pot with correct first contact and no scratch. */
  pot: boolean;
}
export interface ShotTolerance {
  planId: string;
  nominalPot: boolean;
  nominalSuccess: boolean;
  positionTolerance: number;
  axes: Record<ToleranceAxis, AxisTolerance>;
  volume: {
    /** Uniform samples, including zero; physically unavailable speeds fail. */
    points: TolerancePoint[];
    /** Symmetric sampled half-widths, identical for every plan. */
    limits: Record<ToleranceAxis, number>;
    /** Grid spacing, in degrees, rad/s and percentage points respectively. */
    steps: Record<ToleranceAxis, number>;
    successCount: number;
    potCount: number;
  };
}
export interface SimulateOptions {
  /** Record full replay frames, paths and sound events. Defaults to true. */
  record?: boolean;
  /** Record lightweight cue/object paths even when full frames are disabled. */
  recordPaths?: boolean;
  maxTime?: number;
}
