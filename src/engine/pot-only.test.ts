import { expect, it } from 'vitest'
import { generateScenario } from './scenarios'
import { prepareRound } from './preparation'
import { analyzeRound, analyzeShot } from './analysis'
import { analyzeShotTolerance } from './tolerance'
import { scoresPosition, evaluateShotObjective } from './objectives'
import { buildShotFeedback } from '../lib/shot-feedback'
import { recordLessonResult } from '../lib/session'

it.each([1, 7, 10, 11, 20])('level %i scores legal pots independently of finish targets', level => {
  const prepared = prepareRound(generateScenario(level, 71431 + level * 919))
  expect(scoresPosition(prepared.scenario)).toBe(false)
  const option = prepared.balls[0].options[1]
  const result = analyzeRound(prepared, { ballId: option.plan.ballId, optionId: option.id }, { samples: 64 })
  for (const shot of result.candidates) {
    expect(shot.score).toBe(shot.legalPotRate)
    expect(shot.successRate).toBe(shot.legalPotRate)
  }
  const movedTarget = analyzeShot(prepared.scenario, { ...option.plan, target: { x: 100, y: 100 } }, 64)
  expect(movedTarget.score).toBe(result.selected.score)
  expect(movedTarget.trialSuccesses).toEqual(result.selected.trialSuccesses)
  expect(recordLessonResult(prepared.scenario, result).selected.positionRate).toBeUndefined()
  expect(buildShotFeedback(prepared.scenario, result).reasons[0].detail).toContain('earn no points')
  if (level === 7) {
    const a = result.candidates.find(shot => shot.plan.id === prepared.balls[0].options[0].id)!
    expect(result.selected.potRate).toBeGreaterThan(a.potRate)
    expect(result.selected.scratchRate).toBeLessThan(a.scratchRate)
    expect(result.selected.score).toBeGreaterThan(a.score)
    expect(result.best.plan.id).toBe(option.id)
    expect(result.points).toBe(100)
    const tolerance = analyzeShotTolerance(prepared.scenario, option.plan)
    expect(tolerance.positionTolerance).toBe(0)
    expect(tolerance.volume.points.every(point => point.success === point.pot)).toBe(true)
    for (const patch of [{ scratch: true }, { stopped: false }, { firstContact: null }, { potted: [] }]) {
      expect(evaluateShotObjective(prepared.scenario, option.plan, { ...result.selected.nominal, ...patch }).success).toBe(false)
    }
  }
})

it('still requires a visible position zone after a legal pot', () => {
  const prepared = prepareRound(generateScenario(21, 21 * 919))
  expect(scoresPosition(prepared.scenario)).toBe(true)
  const plan = prepared.balls[0].options[0].plan
  const shot = analyzeShot(prepared.scenario, plan, 8)
  const farZone = { ...prepared.scenario, objective: { ...prepared.scenario.objective!, target: { x: 100, y: 100 } } }
  const outcome = evaluateShotObjective(farZone, plan, shot.nominal)
  expect(outcome.legalPot).toBe(true)
  expect(outcome.positioned).toBe(false)
  expect(outcome.success).toBe(false)
})
