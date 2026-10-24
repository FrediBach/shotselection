import type { SequenceOrder, SequenceComparison } from './sequence-reliability';
import type { BackwardPlan } from './backward-planning';
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
/** Authored, repeatable defects; omitted properties behave like a normal table. */
export interface TableConditions {
  id: string;
  name: string;
  description: string;
  /** Multiplier for both sliding and rolling friction. */
  cloth?: number;
  /** Acceleration in m/s² on moving balls, limited below rolling drag. */
  nap?: Vec2;
  /** Circular worn or sticky areas; friction multiplies the underlying cloth. */
  patches?: { id: string; center: Vec2; radius: number; friction: number }[];
  /** Absolute cushion restitution, including that rail's pocket jaws. */
  cushions?: { rail: 'top' | 'bottom' | 'left' | 'right'; restitution: number }[];
  /** Repeatable weak stroke or bent cue; angleBias is in radians. */
  cue?: { power: number; angleBias: number; spin: number };
  /** From clean (0) to dirty (1): extra contact friction and lost energy. */
  dirt?: number;
}
export interface LessonBriefing {
  stage: 'introduce' | 'develop' | 'apply';
  focus: string;
  gotcha: string;
}
export interface LessonLearning {
  concept: string;
  prerequisite: string;
  comparison: 'cut-paths' | 'cue-rebound' | 'next-shot-blocker' | 'object-travel' | 'off-center-cue' | 'pocket-entry' | 'scratch-line' | 'avoidable-cushion' | 'cut-transfer' | 'shortlist' | 'near-tie' | 'contact-roll' | 'zone-margin' | 'backward-plan' | 'next-angle-trap' | 'contact-access' | 'draw-decay' | 'position-overshoot' | 'signed-next-angle' | 'intended-next-pocket' | 'nominated-next-ball' | 'key-ball' | 'look-ahead' | 'zone-exit' | 'angle-travel' | 'corridor-diagnosis' | 'stepping-stone' | 'sequence-reliability' | 'fallback-plan' | 'ball-width' | 'moving-traffic' | 'spare-graze' | 'pocket-change' | 'open-corridor' | 'collision-assistance' | 'return-lane' | 'corridor-center' | 'english-routing' | 'elongated-position' | 'kick-introduction' | 'kick-contact' | 'kick-pace' | 'kick-spin' | 'kick-corridor' | 'kick-finish' | 'kick-sequence' | 'kick-middle' | 'kick-error' | 'kick-final' | 'plant-introduction' | 'plant-line' | 'plant-margin' | 'plant-delivery' | 'plant-distance' | 'plant-throw' | 'plant-gap' | 'plant-failure' | 'plant-quality' | 'plant-setup' | 'assignment-failure' | 'conditional-continuation' | 'strength-asymmetry' | 'mirror-english' | 'disconnected-position' | 'defensive-outcome' | 'planned-movement' | 'player-profile' | 'final-ball' | 'landing-recovery';
  /** Restrict direct choices to the authored teaching routes, reflected with the table. */
  pockets?: { ballId: number; pocketId: number }[];
}
export interface CurriculumLesson {
  learning?: LessonLearning;
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
  /** Optional elongated region: radius is its short semi-axis, angle in radians. */
  ellipse?: { longRadius: number; angle: number };
  /** Two disjoint circular target regions with the shared radius. */
  regions?: [Vec2, Vec2];
  /** Largest acceptable direct next-ball cut, in degrees. */
  maxCutAngle: number;
  /** Assigned during preparation when the lesson does not specify a fixed zone. */
  target?: Vec2;
}
/** A set-up trick is judged by its actual collision sequence and complete pot. */
export interface TrickObjective {
  ballId: number;
  /** Primary ball whose route is drawn in the outcome view. */
  potBallId: number;
  pocketId: number;
  description: string;
  /** Authored contact line; reflected with the complete table. */
  aim: Vec2;
  requiredPots: number[];
  /** These physical contacts must occur in order; either pair orientation is valid. */
  requiredContacts: [number, number][];
  /** Object-ball cushions before the primary ball drops. */
  minObjectCushions?: number;
}
export interface Scenario {
  level: number;
  seed: number;
  title: string;
  description: string;
  balls: Ball[];
  conditions?: TableConditions;
  curriculum?: CurriculumLesson;
  objective?: PositionObjective;
  /** Last object ball: any settled legal pot without a scratch wins. */
  finalBall?: { ballId: number };
  /** Required cue/blocker contact that opens a previously blocked next route. */
  plannedMovement?: { blockerId: number };
  /** Secondary training objective after a clean miss; opponent plays this ball directly. */
  defense?: { ballId: number; maxCutAngle: number };
  /** Cue-ball cushions required before the first contact with this object ball. */
  bank?: { ballId: number; minCushions: number };
  /** Contact the first ball to send its paired target towards this pocket. */
  plant?: { ballId: number; targetBallId: number; pocketId: number };
  trick?: TrickObjective;
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
export interface LessonExperiment {
  kind: 'scratch-line' | 'avoidable-cushion' | 'cut-transfer';
  variants: { label: string; plan: ShotPlan; simulation: Simulation; speedTrials?: { multiplier: number; simulation: Simulation }[] }[];
}
export interface DrawDecayExperiment {
  variants: { label: string; scenario: Scenario; plan: ShotPlan; simulation: Simulation; approach: number; launchSpeed: number; launchRollSpeed: number }[];
}
export interface SignedAnglePreview {
  pocketId: number; target: Vec2; radius: number;
  choices: { optionId: string; label: string; cue: Vec2; object: Vec2; ghost: Vec2; departure: Vec2; angle: number }[];
}
export interface PreparedRound {
  landingRecovery?: import('./landing-recovery').LandingRecoveryPreview;
  defenseOptionIds?: [string, string];
  disconnectedPosition?: import('./disconnected-position').DisconnectedPositionPreview;
  mirrorEnglish?: import('./mirror-english').MirrorEnglishPreview;
  strengthAsymmetry?: import('./strength-asymmetry').StrengthAsymmetryPreview;
  continuation?: import('./conditional-continuation').ContinuationPreview;
  plantGap?: import('./plant-gap').PlantGapPreview;
  plantThrow?: import('./plant-throw').PlantThrowExperiment;
  plantDistance?: import('./plant-distance').PlantDistanceExperiment;
  plantDelivery?: import('./plant-delivery').PlantDeliveryPreview;
  plantMargin?: import('./plant-margin').PlantMarginExperiment;
  plantLine?: import('./plant-line').PlantLinePreview;
  plantIntroduction?: import('./plant-introduction').PlantIntroductionPreview;
  kickFinal?: import('./kick-final').KickFinalPreview;
  kickError?: import('./kick-error').KickErrorExperiment;
  kickMiddle?: import('./kick-middle').KickMiddleExperiment;
  kickSequence?: import('./kick-sequence').KickSequencePreview;
  kickFinish?: import('./kick-finish').KickFinishExperiment;
  kickCorridor?: import('./kick-corridor').KickCorridorExperiment;
  kickSpin?: import('./kick-spin').KickSpinExperiment;
  kickPace?: import('./kick-pace').KickPaceExperiment;
  kickContact?: import('./kick-contact').KickContactPreview;
  sequenceComparison?: { referenceId: string; orders: SequenceOrder[] };
  steppingStoneOptionId?: string;
  elongatedPosition?: { alongId: string; acrossId: string };
  englishRouting?: { referenceId: string };
  corridorCenter?: { centerId: string; edgeId: string };
  returnLane?: { riskyId: string; clearId: string };
  collisionAssistance?: { assistedId: string; clearId: string };
  openCorridor?: { openedId: string; blockedId: string; pocketId: number };
  pocketChange?: { originalId: string; adaptedId: string; preferredPocketId: number; alternatePocketId: number; blockerId: number };
  spareGraze?: { grazedId: string; clearId: string };
  movingTraffic?: { blockedId: string; clearId: string; pocketId: number };
  fallbackPlan?: { narrowId: string; flexibleId: string };
  zoneExit?: { blockedId: string; clearId: string; blockerId: number; pocketId: number };
  /** Two opening choices in the controlled second-shot comparison. */
  lookAheadOptionIds?: string[];
  nextBallNominations?: { ballId: number; lostId: string; keptId: string }[];
  signedAnglePreview?: SignedAnglePreview;
  drawDecay?: DrawDecayExperiment;
  backwardPlan?: BackwardPlan;
  contactAccessPocket?: number;
  /** Controlled, unscored demonstrations derived from this prepared layout. */
  experiment?: LessonExperiment;
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
  /** Speeds immediately before and after the solver step containing first contact. */
  firstImpact?: { ballId: number; time: number; position: Vec2; cueSpeedBefore: number; cueRollSpeedBefore?: number; objectSpeedBefore: number; cueSpeedAfter: number; objectSpeedAfter: number };
  /** Opt-in cue/object impact evidence across one solver step, before rail resolution. */
  cueContacts?: { ballId: number; time: number; position: Vec2; otherPosition: Vec2; incoming: Vec2; outgoing: Vec2; pottedBefore: number[] }[];
  /** Recorded first-plant-ball centers from cue contact through the transfer. */
  plantTransferPath?: Vec2[];
  /** Opt-in collision-dispatch state, with outgoing velocities captured after the solver step. */
  contactEvents?: { ballIds: [number, number]; time: number; positions: [Vec2, Vec2]; incoming: [Vec2, Vec2]; outgoing?: [Vec2, Vec2]; pottedBefore: number[] }[];
  /** Actual cue-ball rebounds before its first object-ball contact. */
  cueBanksBeforeContact?: number;
  /** Actual cue-ball rebounds, including post-contact events; also retained without replay. */
  cueRebounds?: { time: number; position: Vec2; beforeContact: boolean; incoming: Vec2; outgoing: Vec2 }[];
  /** Ordered distinct impacts, retained even when replay recording is disabled. */
  ballContacts?: [number, number][];
  /** Rebounds by the primary object ball before it is pocketed. */
  objectCushions?: number;
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
  /** Objective success in common-random-number trial order, for paired comparisons. */
  trialSuccesses?: boolean[];
  trialLegalPots?: boolean[];
  assignmentFailures?: number[];
  movementTrials?: { contact: boolean; opened: boolean }[];
  defenseTrials?: import('./defensive-outcome').DefenseTrial[];
  defenseExamples?: Partial<Record<'open' | 'screened', import('./defensive-outcome').DefenseExample>>;
  /** Actual scoring trials for the disconnected-region lesson, in trial order. */
  disconnectedTrials?: { point: Vec2; region: number; gap: boolean; settled: boolean; scratch: boolean; nextShotAvailable: boolean; legalPot: boolean; success: boolean }[];
  trialTargetCredits?: number[];
  /** Any cue/ball-3 contact in each scoring trial, including failed trials. */
  spareContactTrials?: boolean[];
  /** First failed link (or complete success/unsettled), in scoring-trial order. */
  plantTrialStages?: import('./plant-failure').PlantTrialStage[];
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
  playerProfiles?: import('./player-profile').PlayerProfileComparison;
  continuation?: import('./conditional-continuation').ContinuationAnalysis;
  plantSetup?: import('./plant-setup').PlantSetupShot[];
  sequenceComparison?: SequenceComparison & { referenceId: string };
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
  /** Record ordered ball/ball contact positions, incoming and immediate post-solver velocities, plus cue/object solver-step evidence. */
  recordContacts?: boolean;
  /** Diagnostic only: remove tangential friction solely between the two plant balls. */
  disablePlantTransferFriction?: boolean;
  /** Record the first plant ball every solver step until its target contact. */
  recordPlantTransfer?: boolean;
  maxTime?: number;
}
