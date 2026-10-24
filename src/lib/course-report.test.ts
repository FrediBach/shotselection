import { describe, expect, it } from 'vitest'
import { DEFAULT_CHARACTER } from '../engine/characters'
import { scoreSelection } from '../engine/scoring'
import type { RoundAnalysis, Scenario, ShotAnalysis } from '../engine/types'
import { buildCourseReport } from './course-report'
import { freshSession, recordLessonResult, type LessonEvidence, type LessonResult } from './session'

function evidence(gap = 20): LessonEvidence {
  return {
    selected: { quality: .5, successRate: .4, potRate: .9 - gap / 100, scratchRate: .05, positionRate: .9, nextShotRate: .9 },
    best: { quality: .9, successRate: .85, potRate: .9, scratchRate: .05, positionRate: .9, nextShotRate: .9 },
  }
}
const records = (gaps: number[]): LessonResult[] => gaps.map((gap, index) => ({ level: index + 1, points: 60, evidence: evidence(gap) }))
const report = (history?: LessonResult[]) => buildCourseReport({ ...freshSession(DEFAULT_CHARACTER),
  completedLessons: 100, level: 101, rounds: 100, score: 8000, perfect: 20, history })
const potting = (history: LessonResult[]) => report(history).weaknesses.find(item => item.id === 'potting')!

describe('course score report', () => {
  it('preserves zero scores and computes real chapter and first/last-half averages', () => {
    const history = Array.from({ length: 100 }, (_, index) => ({ level: index + 1, points: index < 50 ? 40 : 80 }))
    history[0].points = 0
    const result = report(history)
    expect(result.history[0]).toEqual({ level: 1, points: 0 })
    expect(result).toMatchObject({ recordedLevels: 100, missingLevels: 0, average: 59.6,
      earlyAverage: 39.2, lateAverage: 80 })
    expect(result.change).toBeCloseTo(40.8)
    expect(result.chapters).toHaveLength(10)
    expect(result.chapters[0]).toMatchObject({ id: 'fundamentals', count: 10, average: 36, earlyAverage: 32, lateAverage: 40, change: 8 })
    expect(result.chapters[9]).toMatchObject({ id: 'broken-table', count: 10, average: 80 })
  })

  it('does not reconstruct absent results from legacy totals or mistake them for zeros', () => {
    const result = report()
    expect(result).toMatchObject({ history: [], recordedLevels: 0, missingLevels: 100, average: null,
      earlyAverage: null, lateAverage: null, change: null, longestPerfectStreak: 0 })
    expect(result.chapters.every(chapter => chapter.count === 0 && chapter.average === null)).toBe(true)
    expect(result.weaknesses.every(weakness => weakness.status === 'limited' && weakness.count === 0)).toBe(true)
  })

  it('does not infer a chapter or whole-course trend from a few scattered results', () => {
    const result = report([{ level: 1, points: 0 }, { level: 10, points: 100 }, { level: 100, points: 80 }])
    expect(result).toMatchObject({ recordedLevels: 3, missingLevels: 97, average: 60, change: null })
    expect(result.chapters[0]).toMatchObject({ count: 2, average: 50, earlyAverage: null, lateAverage: null, change: null })
    expect(result.chapters[9]).toMatchObject({ count: 1, average: 80, earlyAverage: null, lateAverage: null })
  })

  it('breaks a perfect streak at both missing lessons and non-perfect choices', () => {
    const result = report([{ level: 1, points: 100 }, { level: 2, points: 100 },
      { level: 4, points: 100 }, { level: 5, points: 100 }, { level: 6, points: 100 },
      { level: 7, points: 90 }, { level: 8, points: 100 }].reverse())
    expect(result.longestPerfectStreak).toBe(3)
    expect(result.history.map(item => item.level)).toEqual([1, 2, 4, 5, 6, 7, 8])
  })

  it('reports no course results for sandbox sessions even if an unrelated history was supplied', () => {
    const result = buildCourseReport({ ...freshSession(DEFAULT_CHARACTER, 'sandbox'), history: records([20, 20, 20, 20, 20, 20]) })
    expect(result).toMatchObject({ recordedLevels: 0, missingLevels: 0, average: null, longestPerfectStreak: 0 })
    expect(result.weaknesses.every(weakness => weakness.count === 0)).toBe(true)
  })
})

describe('evidence-based decision weaknesses', () => {
  it('requires six eligible decisions and measures the earliest and latest thirds', () => {
    expect(potting(records([20, 20, 20, 20, 20]))).toMatchObject({ status: 'limited', count: 5, earlyGap: null, lateGap: null })
    const result = potting(records([20, 20, 0, 90, 20, 20]))
    expect(result).toMatchObject({ status: 'persistent', count: 6 })
    expect(result.earlyGap).toBeCloseTo(20)
    expect(result.lateGap).toBeCloseTo(20)
  })

  it.each([
    [20, 20, 'persistent'], [20, 16, 'persistent'], [40, 34, 'persistent'],
    [20, 10, 'improving'], [20, 2, 'resolved'], [2, 20, 'emerging'], [2, 2, 'steady'],
  ])('classifies an early %spp gap and recent %spp gap as %s', (early, late, status) => {
    const result = potting(records([early as number, early as number, 10, 10, late as number, late as number]))
    expect(result.status).toBe(status)
    expect(result.earlyGap).toBeCloseTo(early as number)
    expect(result.lateGap).toBeCloseTo(late as number)
  })

  it('does not diagnose a recurring weakness from one outlier in either window', () => {
    expect(potting(records([90, 0, 0, 0, 0, 0, 90, 0, 0])).status).toBe('steady')
  })

  it('uses comparable successes, not raw failed outcomes or character talents', () => {
    const history = records([20, 20, 20, 20, 20, 20])
    for (const item of history) item.evidence!.best.successRate = 0
    expect(potting(history)).toMatchObject({ status: 'limited', count: 0 })
    const withoutEvidence = history.map(({ level, points }) => ({ level, points }))
    expect(potting(withoutEvidence)).toMatchObject({ status: 'limited', count: 0 })
    const poorCharacter = { ...DEFAULT_CHARACTER, talents: { anglePrecision: 0, englishPrecision: 0, strengthPrecision: 0, spinPrecision: 0 } }
    const actual = buildCourseReport({ ...freshSession(poorCharacter), completedLessons: 6, level: 7, rounds: 6, history })
    expect(actual.weaknesses.every(weakness => weakness.status === 'limited')).toBe(true)
  })

  it('never calls a perfect or equal-quality decision a weakness, and counts these choices toward improvement', () => {
    const history = records([20, 20, 20, 20, 20, 20])
    history[4].points = 100
    history[5].evidence!.selected.quality = history[5].evidence!.best.quality
    expect(potting(history)).toMatchObject({ status: 'resolved', count: 6, lateGap: 0, levels: [4, 3, 2, 1] })
    expect(potting(history.map(item => ({ ...item, points: 100 })))).toMatchObject({ status: 'steady', earlyGap: 0, lateGap: 0, levels: [] })
  })

  it('measures scratch excess in the opposite direction and limits next-shot evidence to supported rounds', () => {
    const history = records([0, 0, 0, 0, 0, 0])
    for (const item of history) {
      item.evidence!.selected.scratchRate = .35
      item.evidence!.selected.positionRate = .6
      delete item.evidence!.selected.nextShotRate
      delete item.evidence!.best.nextShotRate
    }
    const weaknesses = report(history).weaknesses
    expect(weaknesses.find(item => item.id === 'scratch')).toMatchObject({ status: 'persistent', count: 6 })
    expect(weaknesses.find(item => item.id === 'scratch')!.lateGap).toBeCloseTo(30)
    expect(weaknesses.find(item => item.id === 'position')!.lateGap).toBeCloseTo(30)
    expect(weaknesses.find(item => item.id === 'next-shot')).toMatchObject({ status: 'limited', count: 0 })
    expect(weaknesses.find(item => item.id === 'potting')).toMatchObject({ status: 'steady', lateGap: 0 })
  })

  it('does not let diagnostic advantages cancel other decisions with avoidable gaps', () => {
    const history = records([20, 20, -10, -10, 20, 20])
    expect(potting(history)).toMatchObject({ status: 'persistent', count: 6 })
    const allAdvantages = records([-10, -10, -10, -10, -10, -10])
    expect(potting(allAdvantages)).toMatchObject({ status: 'steady', earlyGap: 0, lateGap: 0 })
  })

  it('returns only genuinely affected recent levels for follow-up practice', () => {
    expect(potting(records([20, 0, 20, 20, 20, 20, 0, 20, 20])).levels).toEqual([9, 8, 6, 5, 4])
  })
})

describe('lesson outcome recording', () => {
  const point = { x: 1, y: .5 }
  const shot: ShotAnalysis = {
    plan: { id: 'test', ballId: 1, pocketId: 1, target: point, angle: 0, speed: 1.3, topSpin: 0, sideSpin: 0, label: 'Test' },
    score: .7, successRate: .6, potRate: .8, scratchRate: .05, positionRate: .75, nextShotRate: .7,
    legalPotRate: .7, targetQuality: .6, spread: .1, meanEnd: point, samples: 64, explanation: '',
    samplePaths: [], sampleObjectPaths: [], sampleEnds: [], sampleBallEnds: [],
    nominal: { frames: [], finalBalls: [], soundEvents: [], cuePath: [], cueApproachPath: [], objectPath: [], cueEnd: point,
      potted: [1], scratch: false, firstContact: 1, duration: 1, stopped: true },
  }
  const scoring = scoreSelection(shot, [shot])
  const analysis: RoundAnalysis = { selected: shot, best: shot, candidates: [shot], scoring, points: scoring.points, samples: 64, positionTolerance: .19 }
  const scenario: Scenario = { level: 1, seed: 42, title: 'Test', description: '', balls: [] }

  it('stores compact measured rates, omitting inapplicable next-shot diagnostics and all simulation geometry', () => {
    expect(recordLessonResult(scenario, analysis)).toEqual({
      selected: { quality: .7, successRate: .6, potRate: .8, scratchRate: .05, positionRate: .75 },
      best: { quality: .7, successRate: .6, potRate: .8, scratchRate: .05, positionRate: .75 },
    })
  })

  it('excludes position from a final-ball decision and retains next-shot rates only for a next-ball objective', () => {
    const final = recordLessonResult({ ...scenario, finalBall: { ballId: 1 } }, analysis)
    expect(final.selected.positionRate).toBeUndefined()
    expect(final.best.positionRate).toBeUndefined()
    const position = recordLessonResult({ ...scenario, objective: { kind: 'position', ballId: 1, nextBallId: 2, target: point, radius: .2, maxCutAngle: 65 } }, analysis)
    expect(position.selected.nextShotRate).toBe(.7)
    expect(position.best.nextShotRate).toBe(.7)
  })
})
