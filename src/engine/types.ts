/** All positions are in metres; x: 0..2.54, y: 0..1.27; cue ball id is 0. */
export interface Vec2 { x: number; y: number }
export interface Ball { id: number; position: Vec2 }
export interface Pocket { id: number; name: string; position: Vec2; kind: 'corner' | 'side' }
export interface Scenario {
  level: number;
  seed: number;
  title: string;
  description: string;
  balls: Ball[];
}
export interface Selection { ballId: number; optionId: string }
export interface ShotPlan {
  id: string;
  ballId: number;
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
export interface Simulation {
  frames: SimulationFrame[];
  cuePath: Vec2[];
  objectPath: Vec2[];
  cueEnd: Vec2;
  potted: number[];
  scratch: boolean;
  firstContact: number | null;
  duration: number;
  /** True only when all unpocketed balls have settled before the time limit. */
  stopped: boolean;
}
export interface ShotAnalysis {
  plan: ShotPlan;
  successRate: number;
  potRate: number;
  scratchRate: number;
  positionRate: number;
  /** RMS cue-ball endpoint spread in metres. */
  spread: number;
  meanEnd: Vec2;
  samplePaths: Vec2[][];
  sampleEnds: Vec2[];
  /** Robust utility in [0,1], based on actual ensemble outcomes. */
  score: number;
  nominal: Simulation;
  samples: number;
  explanation: string;
}
export interface RoundAnalysis {
  candidates: ShotAnalysis[];
  selected: ShotAnalysis;
  best: ShotAnalysis;
  points: 0 | 0.5 | 1;
  samples: number;
  positionTolerance: number;
}
export interface AnalyzeOptions { samples?: number }
export interface SimulateOptions { record?: boolean; maxTime?: number }
