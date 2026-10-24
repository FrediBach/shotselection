import { TOTAL_LEVELS } from '../engine/course'
import { isPlayedAt, isPlaythroughId, type Session } from './session'

export type HighscoreEntry = {
  id: string
  playerName: string
  score: number
  rounds: number
  completedLessons: number
  totalLessons: number
  playedAt: string | null
}

export const HIGHSCORES_STORAGE_KEY = 'shot-selection-highscores'

/** A layout seed is not unique enough to identify a playthrough. */
export function identifyPlaythrough(session: Session): Session {
  if (isPlaythroughId(session.playthroughId)) return session
  const playthroughId = globalThis.crypto?.randomUUID?.()
    ?? `run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`
  return { ...session, playthroughId }
}

export const highscorePercent = (entry: Pick<HighscoreEntry, 'score' | 'rounds'>): number =>
  entry.rounds > 0 ? Math.round(entry.score / entry.rounds) : 0

function nonnegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function normalizeEntry(value: unknown): HighscoreEntry | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return
  const { id, playerName, score, rounds, completedLessons, totalLessons, playedAt } = value as Record<string, unknown>
  if (!isPlaythroughId(id) || typeof playerName !== 'string' || !playerName.trim() || playerName.length > 40 ||
    !nonnegativeInteger(score) || score % 10 !== 0 || !nonnegativeInteger(rounds) || rounds < 1 || score / rounds > 100 ||
    !nonnegativeInteger(totalLessons) || totalLessons < 1 || !nonnegativeInteger(completedLessons) ||
    completedLessons > totalLessons || completedLessons > rounds || (playedAt !== null && !isPlayedAt(playedAt))) return
  return { id, playerName: playerName.trim(), score, rounds, completedLessons, totalLessons, playedAt }
}

function compareEntries(a: HighscoreEntry, b: HighscoreEntry): number {
  return b.score - a.score || b.score / b.rounds - a.score / a.rounds ||
    (b.playedAt ? Date.parse(b.playedAt) : -Infinity) - (a.playedAt ? Date.parse(a.playedAt) : -Infinity) ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
}

/** On a damaged save, retain the furthest recorded state of each playthrough. */
function normalizeEntries(values: unknown[]): HighscoreEntry[] {
  const entries = new Map<string, HighscoreEntry>()
  for (const value of values) {
    const entry = normalizeEntry(value)
    if (!entry) continue
    const previous = entries.get(entry.id)
    if (!previous || entry.rounds > previous.rounds ||
      (entry.rounds === previous.rounds && compareEntries(entry, previous) < 0)) entries.set(entry.id, entry)
  }
  return [...entries.values()].sort(compareEntries)
}

function sameEntry(a: HighscoreEntry, b: HighscoreEntry): boolean {
  return a.id === b.id && a.playerName === b.playerName && a.score === b.score && a.rounds === b.rounds &&
    a.completedLessons === b.completedLessons && a.totalLessons === b.totalLessons && a.playedAt === b.playedAt
}

/** Merge another tab's records without replacing a more advanced playthrough. */
export function mergeHighscores(entries: HighscoreEntry[], incoming: HighscoreEntry[]): HighscoreEntry[] {
  const merged = normalizeEntries([...entries, ...incoming])
  return merged.length === entries.length && merged.every((entry, index) => sameEntry(entry, entries[index])) ? entries : merged
}

export function loadHighscores(): HighscoreEntry[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(HIGHSCORES_STORAGE_KEY) || 'null')
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return []
    const { version, entries } = saved as Record<string, unknown>
    return version === 1 && Array.isArray(entries) ? normalizeEntries(entries) : []
  } catch { return [] }
}

export function saveHighscores(entries: HighscoreEntry[]): boolean {
  try {
    const merged = mergeHighscores(entries, loadHighscores())
    localStorage.setItem(HIGHSCORES_STORAGE_KEY, JSON.stringify({ version: 1, entries: merged }))
    return true
  } catch { return false }
}

/** Update after each scored lesson so unfinished courses are retained as well. */
export function updateHighscores(entries: HighscoreEntry[], session: Session): HighscoreEntry[] {
  if (session.mode !== 'course' || !session.character || session.rounds < 1 || !isPlaythroughId(session.playthroughId)) return entries
  const previous = entries.find(entry => entry.id === session.playthroughId)
  const entry = normalizeEntry({ id: session.playthroughId, playerName: session.character.name,
    score: session.score, rounds: session.rounds, completedLessons: session.completedLessons, totalLessons: TOTAL_LEVELS,
    playedAt: isPlayedAt(session.lastPlayedAt) ? session.lastPlayedAt : previous?.playedAt ?? null })
  if (!entry) return entries
  if (previous && sameEntry(previous, entry)) return entries
  return [...entries.filter(saved => saved.id !== entry.id), entry].sort(compareEntries)
}
