import type { CharacterTalents, PlayerCharacter } from './types';
export type { CharacterTalents, PlayerCharacter } from './types';

export const TALENT_DEFINITIONS: { key: keyof CharacterTalents; label: string; description: string }[] = [
  { key: 'anglePrecision', label: 'Angle precision', description: 'Keeps the cue aimed along the intended line.' },
  { key: 'englishPrecision', label: 'English precision', description: 'Controls left and right sidespin consistently.' },
  { key: 'strengthPrecision', label: 'Strength precision', description: 'Repeats the intended cue speed and shot power.' },
  { key: 'spinPrecision', label: 'Draw / follow precision', description: 'Controls backspin and topspin for the cue-ball finish.' },
];

/** Each preset has 200 talent points; custom characters may use any values. */
export const PREMADE_CHARACTERS: PlayerCharacter[] = [
  { id: 'all-rounder', name: 'Alex Morgan', talents: { anglePrecision: 50, englishPrecision: 50, strengthPrecision: 50, spinPrecision: 50 } },
  { id: 'sharpshooter', name: 'Mina Park', talents: { anglePrecision: 85, englishPrecision: 35, strengthPrecision: 45, spinPrecision: 35 } },
  { id: 'spin-artist', name: 'Jules Vega', talents: { anglePrecision: 30, englishPrecision: 80, strengthPrecision: 30, spinPrecision: 60 } },
  { id: 'pace-setter', name: 'Theo Reed', talents: { anglePrecision: 40, englishPrecision: 30, strengthPrecision: 85, spinPrecision: 45 } },
];

/** A talent of 50 preserves the original ensemble noise exactly. */
export const DEFAULT_CHARACTER = PREMADE_CHARACTERS[0];

/** Validate saved data and return a clean copy with whole-number slider values. */
export function normalizePlayerCharacter(value: unknown): PlayerCharacter | null {
  if (!value || typeof value !== 'object') return null;
  const character = value as Partial<PlayerCharacter>;
  if (typeof character.id !== 'string' || (character.id !== 'custom' && !PREMADE_CHARACTERS.some(preset => preset.id === character.id))) return null;
  if (typeof character.name !== 'string' || !character.name.trim() || character.name.trim().length > 40) return null;
  if (!character.talents || typeof character.talents !== 'object') return null;
  const talents = {} as CharacterTalents;
  for (const { key } of TALENT_DEFINITIONS) {
    const talent = character.talents[key];
    if (typeof talent !== 'number' || !Number.isFinite(talent) || talent < 0 || talent > 100) return null;
    talents[key] = Math.round(talent);
  }
  return { id: character.id, name: character.name.trim(), talents };
}

/** Scale standard deviation, retaining some stroke error at maximum precision. */
export function talentNoiseMultiplier(talent: number): number {
  const bounded = Number.isFinite(talent) ? Math.max(0, Math.min(100, talent)) : 50;
  return 1.75 - bounded * 0.015;
}
