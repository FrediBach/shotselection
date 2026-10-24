import { scoresPosition } from '../engine/objectives'
import { POCKET_GEOMETRY } from '../engine/table-geometry'
import { clamp, distance } from '../engine/math'
import type { RoundAnalysis, Scenario, ShotAnalysis } from '../engine/types'
import { percent, strokeDescription } from './shot-presentation'

export interface ShotFeedback {
  kind: 'best' | 'tied' | 'close' | 'improve' | 'no-success'
  title: string
  summary: string
  reasons: { title: string; detail: string }[]
  tradeoff?: string
  takeaway: string
}

/** Use actual quality and success gaps, independent of rank-group boundaries.
 * A small absolute gap between two poor shots is not a near-best choice. */
export function shotFeedbackVerdict(result: RoundAnalysis): Pick<ShotFeedback, 'kind' | 'title' | 'summary'> {
  const { selected, best, scoring } = result
  if (selected.successRate === 0) return {
    kind: 'no-success', title: 'This shot needs another look.',
    summary: result.candidates.every(shot => shot.successRate === 0)
      ? 'None of the offered shots completed the full objective in these trials. The highest-ranked option is only the best of a difficult set.'
      : selected.plan.id === best.plan.id
      ? 'Your choice ranks highest overall, but it did not complete the full objective in these trials. A top rank alone does not make this a reliable plan.'
      : 'Your choice did not complete the full objective in these trials. The comparison below shows where the other plan gains its advantage.',
  }
  if (selected.plan.id === best.plan.id) return {
    kind: 'best', title: 'You picked the best shot.',
    summary: 'Your choice has the strongest overall quality among the offered shots for your player. You read this table well.',
  }
  if (Math.abs(best.score - selected.score) < 1e-12) return {
    kind: 'tied', title: 'An equally strong decision.',
    summary: 'Your choice shares the best measured quality. These trials give neither top option an overall edge.',
  }
  if (scoring.relativeQuality >= 0.95 - 1e-12 && Math.abs(best.successRate - selected.successRate) <= 0.05 + 1e-12) return {
    kind: 'close', title: 'A very good decision.',
    summary: 'You were only slightly short of the best offered shot. The small edge below is a refinement to a strong choice.',
  }
  return {
    kind: 'improve', title: 'Here’s where the better shot helps.',
    summary: 'The best option earns its advantage from what happens to the balls in this layout. Compare the pot and the cue-ball finish together.',
  }
}

const isPlant = (scenario: Scenario, shot: ShotAnalysis) => !scenario.trick && (shot.plan.potBallId ?? shot.plan.ballId) !== shot.plan.ballId
const stroke = (shot: ShotAnalysis) => `${strokeDescription(shot.plan).toLowerCase()} at ${shot.plan.speed.toFixed(2)} m/s`
const cm = (value: number) => `${(value * 100).toFixed(1)} cm`

function directCut(scenario: Scenario, shot: ShotAnalysis): number | null {
  if (scenario.bank || scenario.trick || isPlant(scenario, shot) || (shot.nominal.cueBanksBeforeContact ?? 0) > 0) return null
  const ball = scenario.balls.find(ball => ball.id === shot.plan.ballId)
  const pocket = POCKET_GEOMETRY.find(pocket => pocket.id === shot.plan.pocketId)
  if (!ball || !pocket) return null
  const length = distance(ball.position, pocket.center)
  if (!length) return null
  const cosine = ((pocket.center.x - ball.position.x) * Math.cos(shot.plan.angle)
    + (pocket.center.y - ball.position.y) * Math.sin(shot.plan.angle)) / length
  return Math.acos(clamp(cosine, -1, 1)) * 180 / Math.PI
}

function potContext(scenario: Scenario, selected: ShotAnalysis, best: ShotAnalysis): string {
  if (scenario.trick) return `This stroke more often pots every required ball in the trick: ${scenario.trick.requiredPots.join(', ')}.`
  if (isPlant(scenario, selected) && !isPlant(scenario, best)) return `Playing ball ${best.plan.ballId} directly removes the extra ball-to-ball transfer through ball ${selected.plan.ballId}.`
  if (isPlant(scenario, best)) return `The alignment through ball ${best.plan.ballId} to ball ${best.plan.potBallId} holds up in this layout, even with the plant’s extra contact.`
  const chosenCut = directCut(scenario, selected)
  const bestCut = directCut(scenario, best)
  if (chosenCut !== null && bestCut !== null && chosenCut - bestCut >= 8) {
    return `Ball ${best.plan.ballId} offers a fuller contact: about ${Math.round(bestCut)}° of cut instead of ${Math.round(chosenCut)}°. A thinner cut makes the contact more sensitive to an aiming error.`
  }
  const pocket = POCKET_GEOMETRY.find(pocket => pocket.id === best.plan.pocketId)
  return `The route to the ${pocket?.name ?? 'chosen'} pocket with ${stroke(best)} tolerates the sampled stroke errors better for this pot.`
}

function routeContext(scenario: Scenario, selected: ShotAnalysis, best: ShotAnalysis): string {
  if (scenario.objective?.ellipse) return ' The elongated target allows more travel along its length than across its width; the complete success rate also requires the next shot.';
  if (scenario.objective?.target && selected.nominal.stopped && best.nominal.stopped && !selected.nominal.scratch && !best.nominal.scratch) {
    const chosenError = distance(selected.nominal.cueEnd, scenario.objective.target)
    const bestError = distance(best.nominal.cueEnd, scenario.objective.target)
    if (chosenError - bestError > 0.02) return ` The planned stroke finishes ${cm(bestError)} from the zone center instead of ${cm(chosenError)}.${bestError < scenario.objective.radius ? ' That leaves more room before a stroke error carries it outside the zone.' : ' That brings the cue ball closer to the required area.'}`
  }
  const length = (shot: ShotAnalysis) => shot.nominal.cuePath.reduce((sum, point, index, path) => sum + (index ? distance(path[index - 1], point) : 0), 0)
  const chosenLength = length(selected)
  const bestLength = length(best)
  if (!selected.nominal.stopped || !best.nominal.stopped || selected.nominal.scratch || best.nominal.scratch
    || !chosenLength || !bestLength || Math.abs(chosenLength - bestLength) < 0.15) return ''
  return ` Its planned cue-ball journey is ${bestLength.toFixed(2)} m, compared with your ${chosenLength.toFixed(2)} m.`
}

/** Explain measured whole-shot differences. No new simulation or claim that
 * changing spin alone causes an advantage: offered plans can also change pace,
 * pocket, target and ball. Diagnostic rates overlap and are never added. */
export function buildShotFeedback(scenario: Scenario, result: RoundAnalysis): ShotFeedback {
  const { selected, best } = result
  const verdict = shotFeedbackVerdict(result)
  if (scenario.finalBall) return { ...verdict,
    summary: `Your stroke legally pots the final ball without a scratch in ${percent(result.selected.successRate)} of trials; the highest offered rate is ${percent(result.best.successRate)}.`,
    reasons: [{ title: 'No next ball, no position target', detail: 'Correct first contact, the final pot, no scratch and all balls stopped complete this objective. Where the cue stops on the table earns no extra credit.' }],
    takeaway: 'Choose the repeatable legal pot. A precise landing is unnecessary when the game is over.',
  }

  if (!scoresPosition(scenario)) return { ...verdict,
    summary: `Your shot legally pots without scratching in ${percent(selected.successRate)} of trials; the highest offered rate is ${percent(best.successRate)}.`,
    reasons: [{ title: 'Pot safely; no position target', detail: `Your shot makes a legal pot without scratching in ${Math.round(selected.successRate * selected.samples)} of ${selected.samples} trials, compared with ${Math.round(best.successRate * best.samples)} of ${best.samples} for the best option. Only this rate determines shot quality. Finish markers and spread describe the cue-ball movement but earn no points.` }],
    takeaway: 'Choose the repeatable legal pot without scratching. The cue may stop anywhere on the table.',
  }

  if (selected.plan.id === best.plan.id) return {
    ...verdict,
    reasons: [{ title: selected.successRate === 0 ? 'What the trials show' : 'Your plan fits this table', detail: `With ${stroke(selected)}, ${percent(selected.legalPotRate)} of trials ${scenario.trick ? 'complete the legal trick' : 'make a legal pot'} and ${percent(selected.successRate)} complete the full objective.${scenario.objective ? ` That includes the landing zone and a clear next shot on ball ${scenario.objective.nextBallId}.` : ' The finish matters as well as dropping the object ball.'}` }],
    takeaway: selected.successRate === 0 ? 'Compare the failed routes before trusting any option on this table.' : 'Keep judging the pot and the position you leave as one decision.',
  }

  const reasons: { title: string; detail: string; weight: number; takeaway: string }[] = []
  // One observed trial can explain a close result; do not round it into a large advantage.
  const rateThreshold = 0.5 / Math.max(selected.samples, best.samples)
  const add = (gain: number, title: string, detail: string, takeaway: string) => {
    if (gain > rateThreshold) reasons.push({ title, detail, weight: gain, takeaway })
  }
  add(best.potRate - selected.potRate, 'A more repeatable pot',
    `${potContext(scenario, selected, best)} ${scenario.trick ? 'All required balls drop' : 'The intended ball drops'} with correct first contact in ${percent(best.potRate)} of trials, compared with ${percent(selected.potRate)} for your choice.`,
    'Look for a pot that survives small contact errors, then choose the cue-ball finish you can repeat.')
  add(selected.scratchRate - best.scratchRate, 'Keep the cue ball on the table',
    `With ${stroke(best)}, the cue ball scratches in ${percent(best.scratchRate)} of trials, compared with ${percent(selected.scratchRate)} for your route. This stroke and finish expose you to fewer losing paths into a pocket; a pot is wasted if the cue ball follows it in.`,
    'Read the cue-ball route past the object ball and consider where a small stroke error could send it into a pocket.')
  const spread = selected.sampleEnds.length > 1 && best.sampleEnds.length > 1 && selected.spread - best.spread > 0.01
    ? ` Safe, settled finishes also cluster more tightly: ${cm(best.spread)} of spread versus ${cm(selected.spread)}.` : ''
  add(best.positionRate - selected.positionRate, 'A finish you can hold',
    `With ${stroke(best)}, the cue ball stops ${scenario.objective ? 'inside the shared landing zone' : 'inside its intended finish area'} in ${percent(best.positionRate)} of trials, compared with ${percent(selected.positionRate)} for your choice.${routeContext(scenario, selected, best)}${spread} Here the advantage is keeping position when the stroke varies.${scenario.objective ? '' : ' Each shot is measured against its own intended finish.'}`,
    'Choose spin and pace for the stopping area they make repeatable, not just for the planned endpoint.')
  if (scenario.objective && selected.nextShotRate !== undefined && best.nextShotRate !== undefined) {
    add(best.nextShotRate - selected.nextShotRate, 'Leave the next ball playable',
      `The finish from ${stroke(best)} leaves a clear direct route to ball ${scenario.objective.nextBallId}, within the ${scenario.objective.maxCutAngle}° cut limit, in ${percent(best.nextShotRate)} of trials versus ${percent(selected.nextShotRate)}. Your route more often leaves the next ball blocked, too thin, or unavailable after a scratch or unfinished stroke. Reaching the zone only helps if the next pot is still on.`,
      `Work backward from a clear angle on ball ${scenario.objective.nextBallId} when choosing the first stroke.`)
  }
  if (best.legalPotRate - selected.legalPotRate > rateThreshold && reasons.length === 0) {
    add(best.legalPotRate - selected.legalPotRate, 'Complete a legal pot',
      `${scenario.trick ? 'Legal tricks' : 'Legal pots'} rise from ${percent(selected.legalPotRate)} to ${percent(best.legalPotRate)}. These require the correct first contact, no scratch and all balls stopped${scenario.bank ? `, plus at least ${scenario.bank.minCushions} cue-ball cushion contacts before ball ${scenario.bank.ballId}` : ''}${scenario.trick ? ', plus every required pot and contact in the trick' : ''}. Dropping the object ball alone does not meet those conditions.`,
      'Check the full route and a safe finish when comparing two apparent pots.')
  }
  if (!reasons.length && best.successRate - selected.successRate > rateThreshold) {
    add(best.successRate - selected.successRate, 'Make the pot and position work together',
      `The complete objective succeeds in ${percent(best.successRate)} of trials versus ${percent(selected.successRate)}. With ${stroke(best)}, the pot and required finish happen together more often, even though the individual rates look similar.`,
      'Favor the stroke that delivers the pot and the required position in the same attempt.')
  }
  if (!reasons.length && best.targetQuality > selected.targetQuality + 1e-12) reasons.push({
    title: 'More credit for accurate, legal finishes',
    detail: `The edge comes from target accuracy after a legal pot${scenario.objective ? ' with the next shot available' : ''}. The scoring also rewards finishes near the target center, so two shots with similar pass rates can differ in quality. Average target-closeness credit is ${percent(best.targetQuality)} for the best shot, versus ${percent(selected.targetQuality)} for yours; an illegal pot${scenario.objective ? ' or unavailable next shot' : ''} earns none of that credit.`,
    weight: 0, takeaway: 'When both plans look reliable, compare how closely their successful routes hold the intended stopping point.',
  })
  reasons.sort((a, b) => b.weight - a.weight)

  const successTradeoff = selected.successRate - best.successRate > rateThreshold
    ? `Your choice actually completes the full objective more often (${percent(selected.successRate)} versus ${percent(best.successRate)}). The best label reflects overall quality, which also rewards legal pots and target accuracy.` : undefined
  const tradeoffs = [
    { gain: selected.potRate - best.potRate, text: `Your choice pots more often (${percent(selected.potRate)} versus ${percent(best.potRate)}). That advantage is outweighed by the other shot’s overall pot-and-position quality.` },
    { gain: best.scratchRate - selected.scratchRate, text: `Your route scratches less (${percent(selected.scratchRate)} versus ${percent(best.scratchRate)}). The best option still leads on overall quality, so it is a tradeoff rather than a win on every measure.` },
    { gain: selected.positionRate - best.positionRate, text: `Your choice holds its finish area more often (${percent(selected.positionRate)} versus ${percent(best.positionRate)}), but the other plan has the stronger overall combination of legal potting and position.` },
  ].filter(item => item.gain > rateThreshold).sort((a, b) => b.gain - a.gain)

  return {
    ...verdict,
    reasons: verdict.kind === 'tied' ? [] : reasons.slice(0, 2).map(({ title, detail }) => ({ title, detail })),
    tradeoff: verdict.kind === 'tied' ? undefined : successTradeoff ?? tradeoffs[0]?.text,
    takeaway: verdict.kind === 'tied' ? 'Both choices are supported by this comparison; keep weighing the pot and cue-ball position together.' : reasons[0]?.takeaway ?? 'Judge the whole shot: a legal pot, a safe cue ball, and the required position.',
  }
}
