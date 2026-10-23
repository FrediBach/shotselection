import type { Pocket } from './types';
import { TOTAL_LEVELS } from './course';

export const TABLE = {
  length: 2.54,
  width: 1.27,
  ballRadius: 0.028575,
  ballDiameter: 0.05715,
  ballMass: 0.17,
  cornerMouth: 0.1143,
  sideMouth: 0.127,
  cushionDepth: 0.05,
  cornerCutAngle: 142,
  sideCutAngle: 104,
  cornerShelf: 0.032,
  sideShelf: 0.00635,
  cornerPocketRadius: 0.055,
  sidePocketRadius: 0.06,
  step: 1 / 240,
  slidingFriction: 0.2,
  rollingFriction: 0.012,
  ballRestitution: 0.96,
  cushionRestitution: 0.82,
  positionTolerance: 0.19,
} as const;

export const POCKETS: Pocket[] = [
  { id: 0, name: 'top left', position: { x: 0, y: 0 }, kind: 'corner' },
  { id: 1, name: 'top middle', position: { x: 1.27, y: 0 }, kind: 'side' },
  { id: 2, name: 'top right', position: { x: 2.54, y: 0 }, kind: 'corner' },
  { id: 3, name: 'bottom right', position: { x: 2.54, y: 1.27 }, kind: 'corner' },
  { id: 4, name: 'bottom middle', position: { x: 1.27, y: 1.27 }, kind: 'side' },
  { id: 5, name: 'bottom left', position: { x: 0, y: 1.27 }, kind: 'corner' },
];

/** Tighten the finish throughout the course, reaching 8 cm at its final level. */
export const positionToleranceForLevel = (level: number) => {
  const progress = Number.isFinite(level) ? Math.max(0, Math.min(1, (level - 1) / (TOTAL_LEVELS - 1))) : 0;
  return TABLE.positionTolerance * (0.08 / TABLE.positionTolerance) ** progress;
};

export const PHYSICS_NOTES = {
  model: 'Cannon-es sphere collisions at 240 Hz; sliding-to-rolling cloth friction, draw/follow, side spin, finite cushion jaws and six pocket openings.',
  limits: 'A physics-based teaching model, not a validated professional simulator. Cushion rubber, pocket shelf acceptance and ball throw are approximations. No jumps, masse, cue deflection or table-specific calibration.',
  sources: [
    { title: 'WPA equipment specifications', url: 'https://wpapool.com/wp-content/uploads/2024/01/RECOMMENDED-EQUIPMENT-SPECIFICATIONS.pdf' },
    { title: 'Pooltool: billiards physics derivation', url: 'https://ekiefl.github.io/2020/04/24/pooltool-theory/' },
    { title: 'Dr. Dave: measured physical properties', url: 'https://drdavepoolinfo.com/faq/physics/physical-properties/' },
  ],
};
