import { POCKETS, TABLE } from './constants';
import type { Pocket, Vec2 } from './types';

export interface Rail { a: Vec2; b: Vec2 }
export type CushionSide = 'top' | 'bottom' | 'left' | 'right';
type JawKind = Pocket['kind'];
export interface Cushion {
  id: string;
  side: CushionSide;
  /** Along the rail, measured from the centre of the playing surface. */
  start: number;
  end: number;
  startJaw: JawKind;
  endJaw: JawKind;
  polygon: Vec2[];
  nose: Rail;
  jaws: [Rail, Rail];
}
export interface PocketGeometry {
  id: number;
  name: string;
  kind: JawKind;
  center: Vec2;
  radius: number;
  mouth: [Vec2, Vec2];
  mouthCenter: Vec2;
  outward: Vec2;
}

/** Horizontal jaw cuts, measured from the cushion nose into the rail. */
export function cushionJawOffset(kind: JawKind, depth: number): number {
  return kind === 'corner'
    ? depth / Math.tan((180 - TABLE.cornerCutAngle) * Math.PI / 180)
    : depth * Math.tan((TABLE.sideCutAngle - 90) * Math.PI / 180);
}

function cushion(side: CushionSide, start: number, end: number, startJaw: JawKind, endJaw: JawKind, index = 0): Cushion {
  const horizontal = side === 'top' || side === 'bottom';
  const sign = side === 'top' || side === 'left' ? -1 : 1;
  const point = (along: number, depth: number): Vec2 => horizontal
    ? { x: along + TABLE.length / 2, y: (side === 'top' ? 0 : TABLE.width) + sign * depth }
    : { x: (side === 'left' ? 0 : TABLE.length) + sign * depth, y: along + TABLE.width / 2 };
  const a = point(start, 0);
  const b = point(end, 0);
  const backA = point(start - cushionJawOffset(startJaw, TABLE.cushionDepth), TABLE.cushionDepth);
  const backB = point(end + cushionJawOffset(endJaw, TABLE.cushionDepth), TABLE.cushionDepth);
  return { id: `${side}-${index}`, side, start, end, startJaw, endJaw, polygon: [a, b, backB, backA], nose: { a, b }, jaws: [{ a, b: backA }, { a: b, b: backB }] };
}

const cornerInset = TABLE.cornerMouth / Math.SQRT2;
const halfSide = TABLE.sideMouth / 2;

/** The rendered cushion outlines and collision segments use these same points. */
export const CUSHIONS: Cushion[] = [
  ...(['top', 'bottom'] as const).flatMap(side => [
    cushion(side, -TABLE.length / 2 + cornerInset, -halfSide, 'corner', 'side'),
    cushion(side, halfSide, TABLE.length / 2 - cornerInset, 'side', 'corner', 1),
  ]),
  cushion('left', -TABLE.width / 2 + cornerInset, TABLE.width / 2 - cornerInset, 'corner', 'corner'),
  cushion('right', -TABLE.width / 2 + cornerInset, TABLE.width / 2 - cornerInset, 'corner', 'corner'),
];

export const RAILS: Rail[] = CUSHIONS.flatMap(cushion => [cushion.nose, ...cushion.jaws]);

/** A pocket has a nose-to-nose mouth, a cloth shelf, then a recessed round well. */
export const POCKET_GEOMETRY: PocketGeometry[] = POCKETS.map(pocket => {
  const { x, y } = pocket.position;
  const sy = y === 0 ? -1 : 1;
  const sx = x === 0 ? -1 : 1;
  const outward = pocket.kind === 'side' ? { x: 0, y: sy } : { x: sx / Math.SQRT2, y: sy / Math.SQRT2 };
  const mouth: [Vec2, Vec2] = pocket.kind === 'side'
    ? [{ x: x - halfSide, y }, { x: x + halfSide, y }]
    : [{ x: x - sx * cornerInset, y }, { x, y: y - sy * cornerInset }];
  const mouthCenter = { x: (mouth[0].x + mouth[1].x) / 2, y: (mouth[0].y + mouth[1].y) / 2 };
  const radius = pocket.kind === 'corner' ? TABLE.cornerPocketRadius : TABLE.sidePocketRadius;
  const shelf = pocket.kind === 'corner' ? TABLE.cornerShelf : TABLE.sideShelf;
  const center = { x: mouthCenter.x + outward.x * (shelf + radius), y: mouthCenter.y + outward.y * (shelf + radius) };
  return { id: pocket.id, name: pocket.name, kind: pocket.kind, mouth, mouthCenter, outward, center, radius };
});

/** The centre loses slate support at the edge of the visible well. Jaw
 * collisions are resolved first so a ball cannot drop through a facing. */
export function isPocketed(position: Vec2): boolean {
  return POCKET_GEOMETRY.some(pocket => Math.hypot(position.x - pocket.center.x, position.y - pocket.center.y) < pocket.radius);
}
