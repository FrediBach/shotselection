import { TOTAL_LEVELS } from '../engine/scenarios'

export type Session = {
  scoringVersion: 2
  completedLessons: number
  level: number
  score: number
  rounds: number
  perfect: number
  seed: number
}

export const SESSION_STORAGE_KEY = 'shot-selection-session'

export const freshSession = (): Session => ({
  scoringVersion: 2,
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
    const { scoringVersion, level, score, rounds, perfect, seed, completedLessons } = saved as Record<string, unknown>
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
    // Old levels map to the course while keeping earned points and the layout seed.
    const completed = completedLessons === undefined ? Math.min(level - 1, rounds, TOTAL_LEVELS) : completedLessons
    if (!nonnegativeInteger(completed) || completed > TOTAL_LEVELS || completed > rounds) return freshSession()
    if (completedLessons !== undefined && level !== completed + 1) return freshSession()
    return { scoringVersion: 2, completedLessons: completed, level: completed + 1, score: points, rounds, perfect, seed }
  } catch { /* Browser storage is optional, and invalid JSON starts a fresh session. */ }
  return freshSession()
}

/** Only the next unfinished lesson can award points, including after a reload. */
export function completeLesson(session: Session, level: number, points: number): Session {
  if (level !== session.level || session.completedLessons >= TOTAL_LEVELS) return session
  if (!nonnegativeInteger(points) || points > 100 || points % 10 !== 0) return session
  return { ...session, completedLessons: session.completedLessons + 1, level: level + 1,
    rounds: session.rounds + 1, score: session.score + points, perfect: session.perfect + Number(points === 100) }
}
