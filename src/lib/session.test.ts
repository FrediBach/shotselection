import { afterEach, describe, expect, it, vi } from 'vitest'
import { TOTAL_LEVELS } from '../engine/course'
import { DEFAULT_CHARACTER, PREMADE_CHARACTERS } from '../engine/characters'
import type { PlayerCharacter } from '../engine/types'
import { completeLesson, freshSession, loadSession, SESSION_STORAGE_KEY } from './session'

const legacySession = { level: 8, score: 4.5, rounds: 7, perfect: 3, seed: 91822 }
const currentSession = { ...legacySession, scoringVersion: 2, courseVersion: 3, completedLessons: 7, score: 450, character: DEFAULT_CHARACTER }
const customCharacter: PlayerCharacter = {
  id: 'custom', name: 'Custom player',
  talents: { anglePrecision: 100, englishPrecision: 35, strengthPrecision: 0, spinPrecision: 80 },
}

function storedSession(value: unknown) {
  const getItem = vi.fn().mockReturnValue(JSON.stringify(value))
  vi.stubGlobal('localStorage', { getItem })
  return getItem
}

function expectFresh() {
  expect(loadSession()).toEqual({
    scoringVersion: 2, courseVersion: 3, completedLessons: 0, level: 1, score: 0, rounds: 0, perfect: 0,
    seed: expect.any(Number), character: null,
  })
}

afterEach(() => { vi.unstubAllGlobals() })

describe('playthrough characters', () => {
  it.each(PREMADE_CHARACTERS)('keeps the $name preset after reloading', character => {
    const selected = freshSession(character)
    storedSession(selected)
    expect(loadSession()).toEqual(selected)
    expect(selected.character).toEqual(character)
    expect(selected.character).not.toBe(character)
    expect(selected.character?.talents).not.toBe(character.talents)
  })

  it('keeps custom talents, score, progress, and seed across lessons and reloads', () => {
    const initial = freshSession(customCharacter)
    const played = completeLesson(initial, 1, 80)
    expect(played).toMatchObject({ character: customCharacter, completedLessons: 1, level: 2, rounds: 1, score: 80, seed: initial.seed })
    storedSession(played)
    const reloaded = loadSession()
    expect(reloaded).toEqual(played)
    const next = completeLesson(reloaded, 2, 100)
    expect(next).toMatchObject({ character: customCharacter, completedLessons: 2, level: 3, rounds: 2, score: 180, perfect: 1, seed: initial.seed })
  })

  it('copies selected talents so editing a draft cannot change the playthrough', () => {
    const draft = { ...customCharacter, talents: { ...customCharacter.talents } }
    const selected = freshSession(draft)
    draft.talents.anglePrecision = 5
    expect(selected.character).toEqual(customCharacter)
  })

  it('starts a new character selection when resetting a playthrough', () => {
    const played = completeLesson(freshSession(customCharacter), 1, 100)
    expect(played.character).toEqual(customCharacter)
    expect(freshSession()).toMatchObject({ character: null, completedLessons: 0, level: 1, score: 0, rounds: 0, perfect: 0 })
  })

  it('keeps fresh sessions without characters ready for selection', () => {
    const { character: _character, ...saved } = freshSession()
    storedSession(saved)
    expect(loadSession()).toEqual({ ...saved, character: null })
  })

  it('assigns the original precision to existing progress without a character', () => {
    const { character: _character, ...saved } = currentSession
    storedSession(saved)
    expect(loadSession()).toEqual({ ...saved, character: DEFAULT_CHARACTER })
  })

  it.each([
    ['absent', undefined],
    ['null', null],
    ['string', 'custom'],
    ['array', []],
    ['missing name', { ...customCharacter, name: undefined }],
    ['blank name', { ...customCharacter, name: '   ' }],
    ['overlong name', { ...customCharacter, name: 'x'.repeat(41) }],
    ['unknown id', { ...customCharacter, id: 'unknown' }],
    ['missing talents', { ...customCharacter, talents: undefined }],
    ['missing angle precision', { ...customCharacter, talents: { ...customCharacter.talents, anglePrecision: undefined } }],
    ['negative angle precision', { ...customCharacter, talents: { ...customCharacter.talents, anglePrecision: -1 } }],
    ['English precision above maximum', { ...customCharacter, talents: { ...customCharacter.talents, englishPrecision: 101 } }],
    ['string strength precision', { ...customCharacter, talents: { ...customCharacter.talents, strengthPrecision: '50' } }],
    ['nonfinite spin precision', { ...customCharacter, talents: { ...customCharacter.talents, spinPrecision: Infinity } }],
  ])('recovers from %s character data without losing earned progress', (_label, character) => {
    storedSession({ ...currentSession, character })
    expect(loadSession()).toEqual(currentSession)
    const unplayed = { ...freshSession(), character }
    storedSession(unplayed)
    expect(loadSession()).toEqual({ ...unplayed, character: null })
  })

  it('rejects numeric overflow in saved talents without resetting earned stats', () => {
    const serialized = JSON.stringify({ ...currentSession, character: customCharacter })
      .replace('"anglePrecision":100', '"anglePrecision":1e400')
    vi.stubGlobal('localStorage', { getItem: () => serialized })
    expect(loadSession()).toEqual(currentSession)
  })
})

describe('session scoring migration', () => {
  it('starts a fresh session on the 100-point scale', () => {
    const session = freshSession()
    expect(session).toMatchObject({ scoringVersion: 2, courseVersion: 3, level: 1, score: 0, rounds: 0, perfect: 0, character: null })
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
    ['unsupported course version', { ...currentSession, courseVersion: 4 }],
    ['null course version', { ...currentSession, courseVersion: null }],
    ['string course version', { ...currentSession, courseVersion: '2' }],
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
    ['negative tournament carry', { ...currentSession, carriedTournamentLessons: -1 }],
    ['fractional tournament carry', { ...currentSession, carriedTournamentLessons: 1.5 }],
    ['tournament carry before bank chapter', { ...currentSession, carriedTournamentLessons: 1 }],
    ['tournament carry beyond chapter size', { ...currentSession, completedLessons: 50, level: 51, rounds: 61, carriedTournamentLessons: 11 }],
    ['tournament carry ahead of scored rounds', { ...currentSession, completedLessons: 50, level: 51, rounds: 50, carriedTournamentLessons: 1 }],
    ['tournament carry after plant chapter', { ...currentSession, completedLessons: 70, level: 71, rounds: 71, carriedTournamentLessons: 1 }],
    ['null tournament carry', { ...currentSession, carriedTournamentLessons: null }],
    ['string tournament carry', { ...currentSession, carriedTournamentLessons: '1' }],
    ['carry unsupported in original course', { ...currentSession, courseVersion: undefined, completedLessons: 50, level: 51, rounds: 51, carriedTournamentLessons: 1 }],
    ['v2 carry after bank chapter', { ...currentSession, courseVersion: 2, completedLessons: 60, level: 61, rounds: 61, carriedTournamentLessons: 1 }],
    ['v2 completion beyond original length', { ...currentSession, courseVersion: 2, completedLessons: 71, level: 72, rounds: 71 }],
    ['legacy completion beyond original length', { ...currentSession, courseVersion: undefined, completedLessons: 61, level: 62, rounds: 61 }],
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
    const initial = freshSession(DEFAULT_CHARACTER)
    const completed = completeLesson(initial, 1, 80)
    expect(completed).toMatchObject({ completedLessons: 1, level: 2, rounds: 1, score: 80, perfect: 0 })
    expect(completeLesson(completed, 1, 100)).toBe(completed)
    storedSession(completed)
    expect(loadSession()).toEqual(completed)
  })

  it('keeps completed courses complete after reloading', () => {
    let session = freshSession(DEFAULT_CHARACTER)
    for (let level = 1; level <= TOTAL_LEVELS; level++) session = completeLesson(session, level, 100)
    expect(session).toMatchObject({ level: 81, completedLessons: 80, score: 8000, rounds: 80, perfect: 80 })
    expect(completeLesson(session, TOTAL_LEVELS + 1, 100)).toBe(session)
    storedSession(session)
    expect(loadSession()).toEqual(session)
  })

  it('continues a previously completed 18-level course without changing earned stats', () => {
    const saved = { scoringVersion: 2, completedLessons: 18, level: 19, rounds: 18, score: 1260, perfect: 4, seed: 100 }
    storedSession(saved)
    const resumed = loadSession()
    expect(resumed).toEqual({ ...saved, courseVersion: 3, character: DEFAULT_CHARACTER })
    expect(completeLesson(resumed, 18, 100)).toBe(resumed)
    const next = completeLesson(resumed, 19, 80)
    expect(next).toEqual({ ...saved, courseVersion: 3, character: DEFAULT_CHARACTER, completedLessons: 19, level: 20, rounds: 19, score: 1340 })
    storedSession(next)
    expect(loadSession()).toEqual(next)
  })

  it('resumes legacy endless sessions at the new banks while keeping tournament credit and earned scores', () => {
    storedSession({ scoringVersion: 2, level: 91, rounds: 90, score: 6300, perfect: 12, seed: 100 })
    expect(loadSession()).toEqual({ scoringVersion: 2, courseVersion: 3, character: DEFAULT_CHARACTER, completedLessons: 50, level: 51, carriedTournamentLessons: 10, score: 6300, rounds: 90, perfect: 12, seed: 100 })
  })

  it.each([50, 54, 60])('inserts banks and plants after %s original completed levels without losing tournament credit', completedLessons => {
    const saved = { scoringVersion: 2, completedLessons, level: completedLessons + 1, rounds: completedLessons, score: completedLessons * 80, perfect: 4, seed: 100 }
    storedSession(saved)
    let session = loadSession()
    expect(session).toEqual({ ...saved, courseVersion: 3, character: DEFAULT_CHARACTER, completedLessons: 50, level: 51,
      ...(completedLessons > 50 ? { carriedTournamentLessons: completedLessons - 50 } : {}) })
    storedSession(session)
    expect(loadSession()).toEqual(session)
    for (let level = 51; level <= 59; level++) session = completeLesson(session, level, 80)
    storedSession(session)
    session = loadSession()
    expect(session).toMatchObject({ completedLessons: 59, level: 60, rounds: completedLessons + 9 })
    session = completeLesson(session, 60, 100)
    expect(session).toMatchObject({ completedLessons: 60, level: 61, rounds: completedLessons + 10 })
    for (let level = 61; level <= 69; level++) session = completeLesson(session, level, 80)
    storedSession(session)
    session = loadSession()
    expect(session).toMatchObject({ completedLessons: 69, level: 70, rounds: completedLessons + 19 })
    session = completeLesson(session, 70, 100)
    expect(session).toEqual({ ...saved, courseVersion: 3, character: DEFAULT_CHARACTER, completedLessons: completedLessons + 20,
      level: completedLessons + 21, rounds: completedLessons + 20, score: saved.score + 1640, perfect: 6 })
    expect(completeLesson(session, 70, 100)).toBe(session)
    storedSession(session)
    expect(loadSession()).toEqual(session)
  })

  it.each([60, 64, 70])('inserts plants after %s v2 completed levels while retaining banks and tournament credit', completedLessons => {
    const saved = { scoringVersion: 2, courseVersion: 2, completedLessons, level: completedLessons + 1,
      rounds: completedLessons, score: completedLessons * 80, perfect: 4, seed: 100 }
    storedSession(saved)
    let session = loadSession()
    expect(session).toEqual({ ...saved, courseVersion: 3, character: DEFAULT_CHARACTER, completedLessons: 60, level: 61,
      ...(completedLessons > 60 ? { carriedTournamentLessons: completedLessons - 60 } : {}) })
    storedSession(session)
    expect(loadSession()).toEqual(session)
    for (let level = 61; level <= 69; level++) session = completeLesson(session, level, 80)
    storedSession(session)
    session = loadSession()
    expect(session).toMatchObject({ completedLessons: 69, level: 70, rounds: completedLessons + 9 })
    session = completeLesson(session, 70, 100)
    expect(session).toEqual({ ...saved, courseVersion: 3, character: DEFAULT_CHARACTER, completedLessons: completedLessons + 10,
      level: completedLessons + 11, rounds: completedLessons + 10, score: saved.score + 820, perfect: 5 })
    storedSession(session)
    expect(loadSession()).toEqual(session)
    expect(completeLesson(session, 70, 100)).toBe(session)
  })

  it('preserves v2 bank progress and carried tournament credit until both new chapters are finished', () => {
    const saved = { scoringVersion: 2, courseVersion: 2, completedLessons: 56, level: 57,
      carriedTournamentLessons: 4, rounds: 60, score: 4800, perfect: 4, seed: 100 }
    storedSession(saved)
    let session = loadSession()
    expect(session).toEqual({ ...saved, courseVersion: 3, character: DEFAULT_CHARACTER })
    for (let level = 57; level <= 60; level++) session = completeLesson(session, level, 80)
    expect(session).toMatchObject({ completedLessons: 60, level: 61, carriedTournamentLessons: 4, rounds: 64 })
    storedSession(session)
    expect(loadSession()).toEqual(session)
    for (let level = 61; level <= 70; level++) session = completeLesson(session, level, 80)
    expect(session).toEqual({ ...saved, courseVersion: 3, character: DEFAULT_CHARACTER, completedLessons: 74, level: 75,
      carriedTournamentLessons: undefined, rounds: 74, score: 5920 })
    storedSession(session)
    expect(loadSession()).toEqual(session)
  })

  it.each([7, 50, 56, 59])('preserves v2 progress before plants at %s completed lessons', completedLessons => {
    const saved = { ...freshSession(DEFAULT_CHARACTER), courseVersion: 2, completedLessons, level: completedLessons + 1, rounds: completedLessons }
    storedSession(saved)
    expect(loadSession()).toEqual({ ...saved, courseVersion: 3 })
  })

  it.each([60, 64, 69, 74])('keeps current progress at %s completed lessons without repeating the insertion', completedLessons => {
    const saved = { ...freshSession(DEFAULT_CHARACTER), completedLessons, level: completedLessons + 1, rounds: completedLessons }
    storedSession(saved)
    expect(loadSession()).toEqual(saved)
  })

  it('keeps current bank progress on reload without applying the insertion migration again', () => {
    const saved = { ...freshSession(DEFAULT_CHARACTER), completedLessons: 56, level: 57, rounds: 56, score: 4480, perfect: 4 }
    storedSession(saved)
    expect(loadSession()).toEqual(saved)
  })

  it('does not complete a lesson that was not played or award invalid points', () => {
    const session = freshSession()
    expect(completeLesson(session, 2, 100)).toBe(session)
    for (const points of [-10, 15, 110, NaN]) expect(completeLesson(session, 1, points)).toBe(session)
  })
})
