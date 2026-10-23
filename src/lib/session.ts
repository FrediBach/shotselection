import { TOTAL_LEVELS } from '../engine/course'

export type Session = {
  scoringVersion: 2
  courseVersion: 2
  completedLessons: number
  carriedTournamentLessons?: number
  level: number
  score: number
  rounds: number
  perfect: number
  seed: number
}

export const SESSION_STORAGE_KEY = 'shot-selection-session'

export const freshSession = (): Session => ({
  scoringVersion: 2,
  courseVersion: 2,
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
    const { scoringVersion, courseVersion, level, score, rounds, perfect, seed, completedLessons, carriedTournamentLessons } = saved as Record<string, unknown>
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
    if (courseVersion !== undefined && courseVersion !== 2) return freshSession()
    const savedCourseLength = courseVersion === 2 ? TOTAL_LEVELS : 60
    const completed = completedLessons === undefined ? Math.min(level - 1, rounds, savedCourseLength) : completedLessons
    if (!nonnegativeInteger(completed) || completed > savedCourseLength || completed > rounds) return freshSession()
    if (completedLessons !== undefined && level !== completed + 1) return freshSession()
    // Banks were inserted before tournament lessons. Keep that earned credit aside
    // until the new chapter is complete, so no unplayed bank lesson receives credit.
    const carry = courseVersion === undefined ? Math.max(0, completed - 50) : carriedTournamentLessons ?? 0
    const prefix = courseVersion === undefined ? Math.min(completed, 50) : completed
    if (!nonnegativeInteger(carry) || carry > 10 || prefix + carry > rounds ||
      (carry > 0 && (prefix < 50 || prefix >= 60))) return freshSession()
    return { scoringVersion: 2, courseVersion: 2, completedLessons: prefix, level: prefix + 1,
      ...(carry > 0 ? { carriedTournamentLessons: carry } : {}), score: points, rounds, perfect, seed }
  } catch { /* Browser storage is optional, and invalid JSON starts a fresh session. */ }
  return freshSession()
}

/** Only the next unfinished lesson can award points, including after a reload. */
export function completeLesson(session: Session, level: number, points: number): Session {
  if (level !== session.level || session.completedLessons >= TOTAL_LEVELS) return session
  if (!nonnegativeInteger(points) || points > 100 || points % 10 !== 0) return session
  const { carriedTournamentLessons, ...earned } = session
  const carry = carriedTournamentLessons ?? 0
  const completed = session.completedLessons + 1 + (level === 60 ? carry : 0)
  return { ...earned, ...(carry > 0 && level < 60 ? { carriedTournamentLessons: carry } : {}),
    completedLessons: completed, level: completed + 1,
    rounds: session.rounds + 1, score: session.score + points, perfect: session.perfect + Number(points === 100) }
}
