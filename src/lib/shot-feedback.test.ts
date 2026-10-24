import { describe, expect, it } from 'vitest'
import { scoreSelection } from '../engine/scoring'
import type { RoundAnalysis, Scenario, ShotAnalysis } from '../engine/types'
import { buildShotFeedback, shotFeedbackVerdict } from './shot-feedback'

const scenario: Scenario = {
  level: 71, seed: 42, title: 'Test', description: '',
  balls: [{ id: 0, position: { x: 1.27, y: 0.85 } }, { id: 1, position: { x: 1.27, y: 0.3 } }],
}
function shot(id: string, changes: Partial<ShotAnalysis> = {}): ShotAnalysis {
  const point = { x: 1.27, y: 0.5 }
  return {
    plan: { id, ballId: 1, pocketId: 1, target: point, angle: -Math.PI / 2, speed: 1.3, topSpin: 0, sideSpin: 0, label: id },
    successRate: 0.75, potRate: 0.9, legalPotRate: 0.9, targetQuality: 0.7, scratchRate: 0, positionRate: 0.8,
    score: 0.752, spread: 0.1, meanEnd: point, samples: 64, explanation: '',
    samplePaths: [], sampleObjectPaths: [], sampleEnds: [point, point], sampleBallEnds: [],
    nominal: { frames: [], finalBalls: [], soundEvents: [], cuePath: [], cueApproachPath: [], objectPath: [], cueEnd: point, potted: [1], scratch: false, firstContact: 1, duration: 1, stopped: true },
    ...changes,
  }
}
function round(selected: ShotAnalysis, best: ShotAnalysis): RoundAnalysis {
  const candidates = selected === best ? [selected] : [best, selected]
  const scoring = scoreSelection(selected, candidates)
  return { candidates, selected, best, scoring, points: scoring.points, samples: 64, positionTolerance: 0.19 }
}
const details = (result: ReturnType<typeof buildShotFeedback>) => result.reasons.map(reason => reason.detail).join(' ')

describe('shot coaching verdicts', () => {
  it('separates a chosen best shot, an exact tie and a near-best choice', () => {
    const best = shot('best')
    expect(shotFeedbackVerdict(round(best, best)).kind).toBe('best')
    expect(shotFeedbackVerdict(round(shot('equal'), best)).kind).toBe('tied')
    const selected = shot('close', { score: best.score - 0.02, successRate: 0.73 })
    expect(shotFeedbackVerdict(round(selected, best))).toMatchObject({ kind: 'close', title: 'A very good decision.' })
    expect(buildShotFeedback(scenario, round(shot('equal'), best)).reasons).toEqual([])
  })
  it('does not call low-quality shared ranks or large success gaps close', () => {
    expect(shotFeedbackVerdict(round(shot('low', { score: 0.01, successRate: 0.01 }), shot('best', { score: 0.05, successRate: 0.05 }))).kind).toBe('improve')
    expect(shotFeedbackVerdict(round(shot('low', { score: 0.74, successRate: 0.65 }), shot('best'))).kind).toBe('improve')
  })
  it('recognizes close quality even just outside the shared-rank cutoff', () => {
    const result = round(shot('chosen', { score: 0.95, successRate: 0.953125 }), shot('best', { score: 0.996, successRate: 1 }))
    expect(result.scoring.rank).toBe(2)
    expect(shotFeedbackVerdict(result).kind).toBe('close')
  })
  it('never praises a shot with no successful trials, even when it ranks first', () => {
    const best = shot('best', { score: 0.05, successRate: 0 })
    const feedback = buildShotFeedback(scenario, round(best, best))
    expect(feedback.kind).toBe('no-success')
    expect(feedback.summary).toContain('None of the offered shots')
    expect(feedback.reasons[0].title).toBe('What the trials show')
    const mixed = round(best, best)
    mixed.candidates.push(shot('other', { score: 0.01, successRate: 1 / 64 }))
    expect(shotFeedbackVerdict(mixed).summary).toContain('A top rank alone does not make this a reliable plan')
  })
})

describe('evidence for the better choice', () => {
  it('connects the spin/pace choice to repeatable position and actual cue-ball travel', () => {
    const selected = shot('chosen', { positionRate: 0.4, spread: 0.3, score: 0.4 })
    selected.plan.topSpin = 1
    selected.nominal.cuePath = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 0 }]
    const best = shot('best')
    best.plan.topSpin = -0.8
    best.nominal.cuePath = [{ x: 0, y: 0 }, { x: 1, y: 0 }]
    const feedback = buildShotFeedback(scenario, round(selected, best))
    expect(details(feedback)).toContain('backspin 80% · no english (no side spin) at 1.30 m/s')
    expect(details(feedback)).toContain('80% of trials, compared with 40%')
    expect(details(feedback)).toContain('1.00 m, compared with your 2.00 m')
    expect(details(feedback)).toContain('10.0 cm of spread versus 30.0 cm')
    expect(details(feedback)).toContain('Each shot is measured against its own intended finish')
  })
  it('explains a fuller contact for a better direct pot without inventing a bank cut angle', () => {
    const selected = shot('chosen', { potRate: 0.4, score: 0.4 })
    selected.plan.angle += Math.PI / 4
    expect(details(buildShotFeedback(scenario, round(selected, shot('best'))))).toContain('0° of cut instead of 45°')
    expect(details(buildShotFeedback({ ...scenario, bank: { ballId: 1, minCushions: 1 } }, round(selected, shot('best'))))).not.toContain('° of cut')
  })
  it('explains both directions of a plant versus free-ball comparison', () => {
    const plant = shot('plant', { potRate: 0.3, score: 0.3 })
    plant.plan.potBallId = 2
    const free = shot('free')
    free.plan.ballId = 3
    expect(details(buildShotFeedback(scenario, round(plant, free)))).toContain('removes the extra ball-to-ball transfer')
    const reliablePlant = { ...plant, potRate: 0.95, score: 0.9 }
    expect(details(buildShotFeedback(scenario, round(free, reliablePlant)))).toContain('alignment through ball 1 to ball 2')
  })
  it('uses the shared zone and actual next-shot requirement in position lessons', () => {
    const position: Scenario = { ...scenario, objective: { kind: 'position', ballId: 1, nextBallId: 2, radius: 0.1, maxCutAngle: 35, target: { x: 1.27, y: 0.5 } } }
    const selected = shot('chosen', { nextShotRate: 0.3, positionRate: 0.4, score: 0.3 })
    selected.nominal.cueEnd = { x: 1.27, y: 1 }
    const feedback = buildShotFeedback(position, round(selected, shot('best', { nextShotRate: 0.9 })))
    expect(details(feedback)).toContain('ball 2, within the 35° cut limit')
    expect(details(feedback)).toContain('shared landing zone')
    expect(details(feedback)).toContain('zone center instead of 50.0 cm')
    expect(details(feedback)).not.toContain('own intended finish')
  })
  it('acknowledges when the winning quality has a lower full-success rate', () => {
    const selected = shot('chosen', { successRate: 0.8, score: 0.7, scratchRate: 0.2 })
    const feedback = buildShotFeedback(scenario, round(selected, shot('best')))
    expect(feedback.tradeoff).toContain('actually completes the full objective more often (80% versus 75%)')
    expect(feedback.reasons[0].title).toBe('Keep the cue ball on the table')
  })
  it('explains legal route differences and target-accuracy ranking without inventing a success-rate gain', () => {
    const chosen = shot('chosen', { score: 0.7, legalPotRate: 0.8 })
    const bank = { ...scenario, bank: { ballId: 1, minCushions: 2 } }
    expect(details(buildShotFeedback(bank, round(chosen, shot('best'))))).toContain('at least 2 cue-ball cushion contacts')
    const accurate = buildShotFeedback(scenario, round(shot('chosen', { score: 0.7, targetQuality: 0.5 }), shot('best')))
    expect(details(accurate)).toContain('target accuracy after a legal pot')
    expect(details(accurate)).toContain('70% for the best shot, versus 50%')
    expect(details(accurate)).not.toContain('succeeds in')
  })
})
