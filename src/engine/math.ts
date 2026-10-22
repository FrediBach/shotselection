import { TABLE } from './constants';
import type { Vec2 } from './types';

export const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
export const distance = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y);
export const subtract = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });
export const normalize = (v: Vec2): Vec2 => { const l = Math.hypot(v.x, v.y) || 1; return { x: v.x / l, y: v.y / l }; };
export const dot = (a: Vec2, b: Vec2) => a.x * b.x + a.y * b.y;
export function clampTarget(v: Vec2): Vec2 {
  const margin = TABLE.ballRadius * 1.6;
  return { x: clamp(v.x, margin, TABLE.length - margin), y: clamp(v.y, margin, TABLE.width - margin) };
}
export function segmentDistance(point: Vec2, a: Vec2, b: Vec2): number {
  const v = subtract(b, a);
  const t = clamp(dot(subtract(point, a), v) / (dot(v, v) || 1), 0, 1);
  return distance(point, { x: a.x + t * v.x, y: a.y + t * v.y });
}
/** Mulberry32: reproducible layouts and perturbations, independent of Math.random. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let n = state;
    n = Math.imul(n ^ n >>> 15, n | 1);
    n ^= n + Math.imul(n ^ n >>> 7, n | 61);
    return ((n ^ n >>> 14) >>> 0) / 4294967296;
  };
}
export function normalRandom(random: () => number): number {
  return Math.sqrt(-2 * Math.log(Math.max(1e-8, random()))) * Math.cos(2 * Math.PI * random());
}
