export type Session = {
  scoringVersion: 2
  level: number
  score: number
  rounds: number
  perfect: number
  seed: number
}

export const SESSION_STORAGE_KEY = 'shot-selection-session'

export const freshSession = (): Session => ({
  scoringVersion: 2,
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
    const { scoringVersion, level, score, rounds, perfect, seed } = saved as Record<string, unknown>
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
    return { scoringVersion: 2, level, score: points, rounds, perfect, seed }
  } catch { /* Browser storage is optional, and invalid JSON starts a fresh session. */ }
  return freshSession()
}
