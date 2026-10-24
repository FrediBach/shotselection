import { scoresPosition } from '../engine/objectives'
import { TOTAL_LEVELS } from '../engine/course'
import { DEFAULT_CHARACTER, normalizePlayerCharacter } from '../engine/characters'
import type { PlayerCharacter, RoundAnalysis, Scenario } from '../engine/types'

export type GameMode = 'course' | 'sandbox'

/** Only compact, measured outcomes are retained; simulations stay out of storage. */
export type OutcomeRates = {
  quality: number
  successRate: number
  potRate: number
  scratchRate: number
  positionRate?: number
  nextShotRate?: number
}

export type LessonEvidence = { selected: OutcomeRates; best: OutcomeRates }
export type LessonResult = { level: number; points: number; evidence?: LessonEvidence }

export type Session = {
  scoringVersion: 2
  courseVersion: 5
  mode: GameMode
  character: PlayerCharacter | null
  completedLessons: number
  carriedTournamentLessons?: number
  level: number
  score: number
  rounds: number
  perfect: number
  seed: number
  history?: LessonResult[]
}

export const SESSION_STORAGE_KEY = 'shot-selection-session'

export const freshSession = (character: PlayerCharacter | null = null, mode: GameMode = 'course'): Session => ({
  scoringVersion: 2,
  courseVersion: 5,
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

const rate = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1

function normalizeOutcome(value: unknown): OutcomeRates | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return
  const { quality, successRate, potRate, scratchRate, positionRate, nextShotRate } = value as Record<string, unknown>
  if (!rate(quality) || !rate(successRate) || !rate(potRate) || !rate(scratchRate) ||
    (positionRate !== undefined && !rate(positionRate)) || (nextShotRate !== undefined && !rate(nextShotRate))) return
  return { quality, successRate, potRate, scratchRate,
    ...(positionRate !== undefined ? { positionRate } : {}), ...(nextShotRate !== undefined ? { nextShotRate } : {}) }
}

function normalizeEvidence(value: unknown): LessonEvidence | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return
  const raw = value as Record<string, unknown>
  const selected = normalizeOutcome(raw.selected)
  const best = normalizeOutcome(raw.best)
  if (!selected || !best || best.quality < selected.quality - 1e-12) return
  return { selected, best }
}

/** Bad optional history never erases earned progress. Missing levels stay missing. */
export function normalizeLessonHistory(value: unknown, completedLessons: number): LessonResult[] {
  if (!Array.isArray(value)) return []
  const levels = new Set<number>()
  const history: LessonResult[] = []
  for (const entry of value) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue
    const { level, points, evidence } = entry as Record<string, unknown>
    if (!nonnegativeInteger(level) || level < 1 || level > Math.min(completedLessons, TOTAL_LEVELS) || levels.has(level) ||
      !nonnegativeInteger(points) || points > 100 || points % 10 !== 0) continue
    const measured = normalizeEvidence(evidence)
    history.push({ level, points, ...(measured ? { evidence: measured } : {}) })
    levels.add(level)
  }
  return history.sort((a, b) => a.level - b.level)
}

export function recordLessonResult(scenario: Scenario, analysis: RoundAnalysis): LessonEvidence {
  const outcome = (shot: RoundAnalysis['selected']): OutcomeRates => ({
    quality: shot.score, successRate: shot.successRate, potRate: shot.potRate, scratchRate: shot.scratchRate,
    ...(scoresPosition(scenario) ? { positionRate: shot.positionRate } : {}),
    ...(scenario.objective && shot.nextShotRate !== undefined ? { nextShotRate: shot.nextShotRate } : {}),
  })
  return { selected: outcome(analysis.selected), best: outcome(analysis.best) }
}

export function loadSession(): Session {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY) || 'null')
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return freshSession()
    const { scoringVersion, courseVersion, mode, character, level, score, rounds, perfect, seed, completedLessons, carriedTournamentLessons, history } = saved as Record<string, unknown>
    if (mode !== undefined && mode !== 'course' && mode !== 'sandbox') return freshSession()
    if (mode === 'sandbox') {
      const player = normalizePlayerCharacter(character)
      if (scoringVersion !== 2 || (courseVersion !== 3 && courseVersion !== 4 && courseVersion !== 5) || !player || !nonnegativeInteger(seed) ||
        level !== 1 || completedLessons !== 0 || score !== 0 || rounds !== 0 || perfect !== 0 ||
        carriedTournamentLessons !== undefined) return freshSession()
      return { scoringVersion: 2, courseVersion: 5, mode, character: player, completedLessons: 0,
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
    if (courseVersion !== undefined && courseVersion !== 2 && courseVersion !== 3 && courseVersion !== 4 && courseVersion !== 5) return freshSession()
    // Appended chapters preserve every earned lesson. A completed v4 course
    // resumes at Broken table (91); older formats retain their original limits.
    const savedCourseLength = courseVersion === 5 ? TOTAL_LEVELS : courseVersion === 4 ? 90 : courseVersion === 3 ? 80 : courseVersion === 2 ? 70 : 60
    const completed = completedLessons === undefined ? Math.min(level - 1, rounds, savedCourseLength) : completedLessons
    if (!nonnegativeInteger(completed) || completed > savedCourseLength || completed > rounds) return freshSession()
    if (completedLessons !== undefined && level !== completed + 1) return freshSession()
    const savedCarry = carriedTournamentLessons === undefined ? 0 : carriedTournamentLessons
    const includesPlants = courseVersion === 3 || courseVersion === 4 || courseVersion === 5
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
    // Before v3, inserted chapters changed tournament level numbers. Retain only
    // the unchanged prefix; never relabel those old tournament records as kicks/plants.
    const recorded = Array.isArray(history) && scoringVersion === 2 ? normalizeLessonHistory(history, prefix) : undefined
    return { scoringVersion: 2, courseVersion: 5, mode: 'course', completedLessons: prefix, level: prefix + 1,
      ...(carry > 0 ? { carriedTournamentLessons: carry } : {}), character: player, score: points, rounds, perfect, seed,
      ...(recorded ? { history: recorded } : {}) }
  } catch { /* Browser storage is optional, and invalid JSON starts a fresh session. */ }
  return freshSession()
}

/** Only the next unfinished lesson can award points, including after a reload. */
export function completeLesson(session: Session, level: number, points: number, evidence?: LessonEvidence): Session {
  if (session.mode === 'sandbox') return session
  if (level !== session.level || session.completedLessons >= TOTAL_LEVELS) return session
  if (!nonnegativeInteger(points) || points > 100 || points % 10 !== 0) return session
  const { carriedTournamentLessons, ...earned } = session
  const carry = carriedTournamentLessons ?? 0
  const completed = session.completedLessons + 1 + (level === 70 ? carry : 0)
  const measured = normalizeEvidence(evidence)
  return { ...earned, ...(carry > 0 && level < 70 ? { carriedTournamentLessons: carry } : {}),
    completedLessons: completed, level: completed + 1,
    rounds: session.rounds + 1, score: session.score + points, perfect: session.perfect + Number(points === 100),
    history: [...normalizeLessonHistory(session.history, session.completedLessons), { level, points, ...(measured ? { evidence: measured } : {}) }] }
}
