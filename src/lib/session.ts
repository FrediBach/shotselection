import { TOTAL_LEVELS } from '../engine/course'
import { DEFAULT_CHARACTER, normalizePlayerCharacter } from '../engine/characters'
import type { PlayerCharacter } from '../engine/types'

export type GameMode = 'course' | 'sandbox'

export type Session = {
  scoringVersion: 2
  courseVersion: 4
  mode: GameMode
  character: PlayerCharacter | null
  completedLessons: number
  carriedTournamentLessons?: number
  level: number
  score: number
  rounds: number
  perfect: number
  seed: number
}

export const SESSION_STORAGE_KEY = 'shot-selection-session'

export const freshSession = (character: PlayerCharacter | null = null, mode: GameMode = 'course'): Session => ({
  scoringVersion: 2,
  courseVersion: 4,
  mode,
  character: normalizePlayerCharacter(character),
  completedLessons: 0,
  level: 1,
  score: 0,
  rounds: 0,
  perfect: 0,
  seed: Math.floor(Math.random() * 1000000),
})

function nonnegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

export function loadSession(): Session {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY) || 'null')
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return freshSession()
    const { scoringVersion, courseVersion, mode, character, level, score, rounds, perfect, seed, completedLessons, carriedTournamentLessons } = saved as Record<string, unknown>
    if (mode !== undefined && mode !== 'course' && mode !== 'sandbox') return freshSession()
    if (mode === 'sandbox') {
      const player = normalizePlayerCharacter(character)
      if (scoringVersion !== 2 || (courseVersion !== 3 && courseVersion !== 4) || !player || !nonnegativeInteger(seed) ||
        level !== 1 || completedLessons !== 0 || score !== 0 || rounds !== 0 || perfect !== 0 ||
        carriedTournamentLessons !== undefined) return freshSession()
      return { scoringVersion: 2, courseVersion: 4, mode, character: player, completedLessons: 0,
        level: 1, score: 0, rounds: 0, perfect: 0, seed }
    }
    if (!nonnegativeInteger(level) || level < 1 || level >= 10000 ||
      !nonnegativeInteger(rounds) || !nonnegativeInteger(perfect) || perfect > rounds ||
      !nonnegativeInteger(seed) || typeof score !== 'number') return freshSession()

    let points = score
    if (scoringVersion === undefined) {
      // Older rounds awarded 0, 0.5, or 1 point. Preserve their value on the new scale.
      if (!nonnegativeInteger(score * 2) || score > rounds) return freshSession()
      points *= 100
    } else if (scoringVersion !== 2) {
      return freshSession()
    }
    if (!nonnegativeInteger(points) || points % 10 !== 0 || points > rounds * 100) return freshSession()
    if (courseVersion !== undefined && courseVersion !== 2 && courseVersion !== 3 && courseVersion !== 4) return freshSession()
    // Trick shots extend the v3 course, so its completed saves keep all 80
    // lessons and naturally resume at 81. Older formats retain their limits.
    const savedCourseLength = courseVersion === 4 ? TOTAL_LEVELS : courseVersion === 3 ? 80 : courseVersion === 2 ? 70 : 60
    const completed = completedLessons === undefined ? Math.min(level - 1, rounds, savedCourseLength) : completedLessons
    if (!nonnegativeInteger(completed) || completed > savedCourseLength || completed > rounds) return freshSession()
    if (completedLessons !== undefined && level !== completed + 1) return freshSession()
    const savedCarry = carriedTournamentLessons === undefined ? 0 : carriedTournamentLessons
    const includesPlants = courseVersion === 3 || courseVersion === 4
    const carryBoundary = includesPlants ? 70 : 60
    if (!nonnegativeInteger(savedCarry) || savedCarry > 10 || completed + savedCarry > rounds ||
      (savedCarry > 0 && (courseVersion === undefined || completed < 50 || completed >= carryBoundary))) return freshSession()
    // Keep earned tournament credit behind every newly inserted chapter. A v2
    // player can already have earned bank credit, or still be working through
    // banks with tournament credit carried from the original 60-level course.
    const insertion = courseVersion === undefined ? 50 : 60
    const prefix = includesPlants ? completed : Math.min(completed, insertion)
    const carry = savedCarry + completed - prefix
    // Existing playthroughs keep their original ensemble precision. Invalid
    // character data must not erase earned course progress or scores.
    const player = normalizePlayerCharacter(character) ?? (rounds > 0 ? normalizePlayerCharacter(DEFAULT_CHARACTER) : null)
    return { scoringVersion: 2, courseVersion: 4, mode: 'course', completedLessons: prefix, level: prefix + 1,
      ...(carry > 0 ? { carriedTournamentLessons: carry } : {}), character: player, score: points, rounds, perfect, seed }
  } catch { /* Browser storage is optional, and invalid JSON starts a fresh session. */ }
  return freshSession()
}

/** Only the next unfinished lesson can award points, including after a reload. */
export function completeLesson(session: Session, level: number, points: number): Session {
  if (session.mode === 'sandbox') return session
  if (level !== session.level || session.completedLessons >= TOTAL_LEVELS) return session
  if (!nonnegativeInteger(points) || points > 100 || points % 10 !== 0) return session
  const { carriedTournamentLessons, ...earned } = session
  const carry = carriedTournamentLessons ?? 0
  const completed = session.completedLessons + 1 + (level === 70 ? carry : 0)
  return { ...earned, ...(carry > 0 && level < 70 ? { carriedTournamentLessons: carry } : {}),
    completedLessons: completed, level: completed + 1,
    rounds: session.rounds + 1, score: session.score + points, perfect: session.perfect + Number(points === 100) }
}
