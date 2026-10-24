import { afterEach, describe, expect, it, vi } from 'vitest'
import { TOTAL_LEVELS } from '../engine/course'
import { DEFAULT_CHARACTER } from '../engine/characters'
import { completeLesson, freshSession, type Session } from './session'
import {
  HIGHSCORES_STORAGE_KEY, highscorePercent, identifyPlaythrough, loadHighscores, mergeHighscores,
  saveHighscores, updateHighscores, type HighscoreEntry,
} from './highscores'

const playedAt = '2026-10-24T12:30:00.000Z'
const session: Session = { ...completeLesson(freshSession(DEFAULT_CHARACTER), 1, 80),
  playthroughId: 'playthrough-1', lastPlayedAt: playedAt }
const entry: HighscoreEntry = { id: session.playthroughId!, playerName: DEFAULT_CHARACTER.name,
  score: 80, rounds: 1, completedLessons: 1, totalLessons: TOTAL_LEVELS, playedAt }

function storedScores(value: unknown) {
  const storage = { getItem: vi.fn(() => JSON.stringify(value)), setItem: vi.fn() }
  vi.stubGlobal('localStorage', storage)
  return storage
}

afterEach(() => vi.unstubAllGlobals())

describe('playthrough identity', () => {
  it('assigns different identities to runs with the same layout and keeps an assigned identity', () => {
    const first = identifyPlaythrough(session)
    expect(first).toBe(session)
    const initial = freshSession(DEFAULT_CHARACTER)
    const second = identifyPlaythrough(initial)
    const third = identifyPlaythrough(initial)
    expect(second.playthroughId).toEqual(expect.any(String))
    expect(third.playthroughId).not.toBe(second.playthroughId)
    expect(identifyPlaythrough(second)).toBe(second)
    expect(initial.playthroughId).toBeUndefined()
    expect(second.seed).toBe(third.seed)
  })

  it('can assign an identity without browser UUID support', () => {
    vi.stubGlobal('crypto', undefined)
    const identified = identifyPlaythrough(freshSession(DEFAULT_CHARACTER))
    expect(identified.playthroughId).toMatch(/^run-/)
    expect(identifyPlaythrough(identified)).toBe(identified)
  })
})

describe('highscore updates', () => {
  it('retains unfinished runs and updates the same row as lessons are completed', () => {
    const entries = updateHighscores([], session)
    expect(entries).toEqual([entry])
    expect(updateHighscores(entries, session)).toBe(entries)
    const next = { ...completeLesson(session, 2, 100), lastPlayedAt: '2026-10-25T09:00:00.000Z' }
    const updated = updateHighscores(entries, next)
    expect(updated).toEqual([{ ...entry, score: 180, rounds: 2, completedLessons: 2, playedAt: next.lastPlayedAt }])
    expect(entries).toEqual([entry])
    expect(updateHighscores(updated, next)).toBe(updated)
  })

  it('retains the old run when a new playthrough begins and records zero-point rounds', () => {
    const old = [entry]
    const fresh = identifyPlaythrough(freshSession(DEFAULT_CHARACTER))
    expect(updateHighscores(old, fresh)).toBe(old)
    const entries = updateHighscores(old, completeLesson(fresh, 1, 0))
    expect(entries).toHaveLength(2)
    expect(entries[0]).toEqual(entry)
    expect(entries[1]).toMatchObject({ id: fresh.playthroughId, score: 0, rounds: 1, completedLessons: 1, playedAt: null })
  })

  it('ignores sandbox, unplayed, unidentified, and characterless sessions', () => {
    for (const invalid of [
      { ...session, mode: 'sandbox' as const }, { ...session, rounds: 0 },
      { ...session, playthroughId: undefined }, { ...session, character: null },
    ]) expect(updateHighscores([entry], invalid)).toEqual([entry])
  })

  it('keeps dates unknown for imported saves and preserves a known date if metadata is missing', () => {
    const imported = { ...session, lastPlayedAt: undefined }
    expect(updateHighscores([], imported)[0].playedAt).toBeNull()
    const entries = [entry]
    expect(updateHighscores(entries, imported)).toBe(entries)
    expect(updateHighscores(entries, { ...imported, score: 100 })[0].playedAt).toBe(playedAt)
  })

  it('ranks score first, then unrounded scoring percentage, latest play, and stable ID', () => {
    const values: HighscoreEntry[] = [
      { ...entry, id: 'z', score: 100, rounds: 2, completedLessons: 2 },
      { ...entry, id: 'b', score: 100, playedAt: null },
      { ...entry, id: 'c', score: 100, playedAt: '2026-10-23T12:30:00.000Z' },
      { ...entry, id: 'a', score: 100 },
      { ...entry, id: 'd', score: 200, rounds: 3, completedLessons: 3 },
      { ...entry, id: 'aa', score: 100 },
    ]
    storedScores({ version: 1, entries: values })
    expect(loadHighscores().map(value => value.id)).toEqual(['d', 'a', 'aa', 'c', 'b', 'z'])
  })

  it('calculates percentage from scored rounds instead of course progress', () => {
    expect(highscorePercent({ score: 6300, rounds: 90 })).toBe(70)
    expect(highscorePercent({ score: 190, rounds: 3 })).toBe(63)
    expect(highscorePercent({ score: 0, rounds: 1 })).toBe(0)
    expect(highscorePercent({ score: 0, rounds: 0 })).toBe(0)
    const legacy = updateHighscores([], { ...session, score: 6300, rounds: 90, completedLessons: 50 })[0]
    expect(legacy.completedLessons).toBe(50)
    expect(highscorePercent(legacy)).toBe(70)
  })
})

describe('highscore storage', () => {
  it('merges other tabs without regressing progress and returns the original reference when unchanged', () => {
    const other = { ...entry, id: 'another-run', score: 100 }
    const advanced = { ...entry, score: 180, rounds: 2, completedLessons: 2, playedAt: '2026-10-25T12:30:00.000Z' }
    const merged = mergeHighscores([entry], [other, advanced])
    expect(merged).toEqual([advanced, other])
    expect(mergeHighscores(merged, [entry])).toBe(merged)
    expect(mergeHighscores(merged, merged.map(value => ({ ...value })))).toBe(merged)
    const empty: HighscoreEntry[] = []
    expect(mergeHighscores(empty, [])).toBe(empty)
  })

  it('keeps the newest played date when two tabs have the same earned result', () => {
    const recent = { ...entry, playedAt: '2026-10-25T12:30:00.000Z' }
    expect(mergeHighscores([entry], [recent])).toEqual([recent])
    const entries = [recent]
    expect(mergeHighscores(entries, [entry])).toBe(entries)
  })

  it('merges the latest storage before a stale tab saves, preserving other runs and further progress', () => {
    const other = { ...entry, id: 'another-run', score: 100 }
    const advanced = { ...entry, score: 180, rounds: 2, completedLessons: 2, playedAt: '2026-10-25T12:30:00.000Z' }
    let serialized = JSON.stringify({ version: 1, entries: [advanced, other] })
    vi.stubGlobal('localStorage', {
      getItem: () => serialized,
      setItem: (_key: string, value: string) => { serialized = value },
    })
    expect(saveHighscores([entry])).toBe(true)
    expect(loadHighscores()).toEqual([advanced, other])
    expect(saveHighscores([])).toBe(true)
    expect(loadHighscores()).toEqual([advanced, other])
  })

  it('saves a versioned envelope and reloads scores, dates, and the original course length', () => {
    const oldCourse = { ...entry, completedLessons: 90, totalLessons: 90, rounds: 90, score: 7200 }
    const storage = storedScores({ version: 1, entries: [oldCourse] })
    expect(loadHighscores()).toEqual([oldCourse])
    expect(storage.getItem).toHaveBeenCalledWith(HIGHSCORES_STORAGE_KEY)
    expect(saveHighscores([oldCourse])).toBe(true)
    expect(storage.setItem).toHaveBeenCalledWith(HIGHSCORES_STORAGE_KEY, JSON.stringify({ version: 1, entries: [oldCourse] }))
  })

  it.each([null, [], {}, { version: 2, entries: [entry] }, { version: 1, entries: {} }])(
    'ignores invalid containers without throwing: %j', saved => {
      storedScores(saved)
      expect(loadHighscores()).toEqual([])
    },
  )

  it('recovers valid rows while discarding corrupt records and deduplicating playthroughs', () => {
    const furthest = { ...entry, score: 80, rounds: 2, completedLessons: 2, playedAt: '2026-10-25T12:30:00.000Z' }
    const zero = { ...entry, id: 'zero', score: 0, playedAt: null }
    storedScores({ version: 1, entries: [
      null, [], false, { ...entry, id: '' }, { ...entry, id: 'bad id' }, { ...entry, score: -10 },
      { ...entry, score: 110 }, { ...entry, score: 85 }, { ...entry, rounds: 0 },
      { ...entry, rounds: 1.5 }, { ...entry, totalLessons: 0 }, { ...entry, completedLessons: 101 },
      { ...entry, completedLessons: 2 }, { ...entry, playedAt: 'yesterday' },
      { ...entry, playedAt: '2026-02-30T12:30:00.000Z' }, { ...entry, playerName: '' },
      furthest, entry, entry, zero,
    ] })
    expect(loadHighscores()).toEqual([furthest, zero])
  })

  it('does not truncate an older score list', () => {
    const entries = Array.from({ length: 150 }, (_, index) => ({ ...entry, id: `run-${index}` }))
    storedScores({ version: 1, entries })
    expect(loadHighscores()).toHaveLength(entries.length)
  })

  it('tolerates invalid JSON and blocked reads or writes', () => {
    vi.stubGlobal('localStorage', { getItem: () => '{broken' })
    expect(loadHighscores()).toEqual([])
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('Storage blocked') },
      setItem: () => { throw new Error('Quota exceeded') },
    })
    expect(loadHighscores()).toEqual([])
    expect(saveHighscores([entry])).toBe(false)
  })
})
