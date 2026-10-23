import { afterEach, describe, expect, it, vi } from 'vitest'
import { TOTAL_LEVELS } from '../engine/course'
import { completeLesson, freshSession, loadSession, SESSION_STORAGE_KEY } from './session'

const legacySession = { level: 8, score: 4.5, rounds: 7, perfect: 3, seed: 91822 }
const currentSession = { ...legacySession, scoringVersion: 2, completedLessons: 7, score: 450 }

function storedSession(value: unknown) {
  const getItem = vi.fn().mockReturnValue(JSON.stringify(value))
  vi.stubGlobal('localStorage', { getItem })
  return getItem
}

function expectFresh() {
  expect(loadSession()).toEqual({
    scoringVersion: 2, completedLessons: 0, level: 1, score: 0, rounds: 0, perfect: 0,
    seed: expect.any(Number),
  })
}

afterEach(() => { vi.unstubAllGlobals() })

describe('session scoring migration', () => {
  it('starts a fresh session on the 100-point scale', () => {
    const session = freshSession()
    expect(session).toMatchObject({ scoringVersion: 2, level: 1, score: 0, rounds: 0, perfect: 0 })
    expect(Number.isInteger(session.seed)).toBe(true)
    expect(session.seed).toBeGreaterThanOrEqual(0)
    expect(session.seed).toBeLessThan(1000000)
  })

  it('preserves progress and the layout seed while converting old points', () => {
    const getItem = storedSession(legacySession)
    expect(loadSession()).toEqual(currentSession)
    expect(getItem).toHaveBeenCalledWith(SESSION_STORAGE_KEY)
  })

  it.each([0, 0.5, 1])('converts an old round worth %s points', score => {
    storedSession({ ...legacySession, score, rounds: 1, perfect: Number(score === 1) })
    expect(loadSession().score).toBe(score * 100)
  })

  it('does not convert points again after the migrated session is saved', () => {
    storedSession(legacySession)
    const migrated = loadSession()
    storedSession(migrated)
    expect(loadSession()).toEqual(currentSession)
  })

  it('loads current scores in ten-point steps without rescaling', () => {
    storedSession({ ...currentSession, score: 470 })
    expect(loadSession()).toEqual({ ...currentSession, score: 470 })
  })

  it.each([
    ['missing session', null],
    ['wrong shape', []],
    ['unsupported version', { ...currentSession, scoringVersion: 3 }],
    ['null version', { ...currentSession, scoringVersion: null }],
    ['string version', { ...currentSession, scoringVersion: '2' }],
    ['negative score', { ...currentSession, score: -10 }],
    ['fractional score', { ...currentSession, score: 450.5 }],
    ['score outside ten-point steps', { ...currentSession, score: 451 }],
    ['score above available points', { ...currentSession, score: 710 }],
    ['legacy quarter point', { ...legacySession, score: 4.25 }],
    ['legacy score above rounds', { ...legacySession, score: 8 }],
    ['nonfinite score', { ...currentSession, score: Infinity }],
    ['string score', { ...currentSession, score: '450' }],
    ['zero level', { ...currentSession, level: 0 }],
    ['level outside supported range', { ...currentSession, level: 10000 }],
    ['fractional level', { ...currentSession, level: 1.5 }],
    ['negative rounds', { ...currentSession, rounds: -1 }],
    ['fractional rounds', { ...currentSession, rounds: 7.5 }],
    ['unsafe rounds', { ...currentSession, rounds: Number.MAX_SAFE_INTEGER + 1 }],
    ['negative perfect count', { ...currentSession, perfect: -1 }],
    ['fractional perfect count', { ...currentSession, perfect: 1.5 }],
    ['perfect count above rounds', { ...currentSession, perfect: 8 }],
    ['negative seed', { ...currentSession, seed: -1 }],
    ['fractional seed', { ...currentSession, seed: 1.5 }],
    ['nonfinite seed', { ...currentSession, seed: Infinity }],
    ['missing seed', { ...currentSession, seed: undefined }],
    ['course beyond final lesson', { ...currentSession, completedLessons: TOTAL_LEVELS + 1, level: TOTAL_LEVELS + 2, rounds: TOTAL_LEVELS + 1 }],
    ['course ahead of scored rounds', { ...currentSession, completedLessons: 8, level: 9 }],
    ['inconsistent next level', { ...currentSession, completedLessons: 6 }],
    ['fractional course completion', { ...currentSession, completedLessons: 6.5 }],
  ])('resets safely for %s', (_label, saved) => {
    storedSession(saved)
    expectFresh()
  })

  it('recovers from corrupted JSON', () => {
    vi.stubGlobal('localStorage', { getItem: () => '{broken' })
    expectFresh()
  })

  it('works when browser storage is unavailable', () => {
    vi.stubGlobal('localStorage', undefined)
    expectFresh()
  })

  it('works when browser storage throws', () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('Storage blocked') } })
    expectFresh()
  })
})


describe('course progression', () => {
  it('awards a lesson once and preserves the next unfinished level', () => {
    const initial = freshSession()
    const completed = completeLesson(initial, 1, 80)
    expect(completed).toMatchObject({ completedLessons: 1, level: 2, rounds: 1, score: 80, perfect: 0 })
    expect(completeLesson(completed, 1, 100)).toBe(completed)
    storedSession(completed)
    expect(loadSession()).toEqual(completed)
  })

  it('keeps completed courses complete after reloading', () => {
    let session = freshSession()
    for (let level = 1; level <= TOTAL_LEVELS; level++) session = completeLesson(session, level, 100)
    expect(session).toMatchObject({ level: 61, completedLessons: 60, score: 6000, rounds: 60, perfect: 60 })
    expect(completeLesson(session, TOTAL_LEVELS + 1, 100)).toBe(session)
    storedSession(session)
    expect(loadSession()).toEqual(session)
  })

  it('continues a previously completed 18-level course without changing earned stats', () => {
    const saved = { scoringVersion: 2, completedLessons: 18, level: 19, rounds: 18, score: 1260, perfect: 4, seed: 100 }
    storedSession(saved)
    const resumed = loadSession()
    expect(resumed).toEqual(saved)
    expect(completeLesson(resumed, 18, 100)).toBe(resumed)
    const next = completeLesson(resumed, 19, 80)
    expect(next).toEqual({ ...saved, completedLessons: 19, level: 20, rounds: 19, score: 1340 })
    storedSession(next)
    expect(loadSession()).toEqual(next)
  })

  it('caps legacy endless progress while keeping earned scores', () => {
    storedSession({ scoringVersion: 2, level: 91, rounds: 90, score: 6300, perfect: 12, seed: 100 })
    expect(loadSession()).toEqual({ scoringVersion: 2, completedLessons: 60, level: 61, score: 6300, rounds: 90, perfect: 12, seed: 100 })
  })

  it('does not complete a lesson that was not played or award invalid points', () => {
    const session = freshSession()
    expect(completeLesson(session, 2, 100)).toBe(session)
    for (const points of [-10, 15, 110, NaN]) expect(completeLesson(session, 1, points)).toBe(session)
  })
})
