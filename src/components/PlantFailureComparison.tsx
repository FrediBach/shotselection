import { useState } from 'react'
import { Button } from './ui/button'
import { PLANT_FAILURE_LINKS, PLANT_STAGE_LABELS, plantFailureSummary } from '../engine/plant-failure'
import type { PlantFailureLink, PlantTrialStage } from '../engine/plant-failure'
import type { PreparedRound, RoundAnalysis } from '../engine/types'
const stages: PlantTrialStage[] = [...PLANT_FAILURE_LINKS, 'success', 'unsettled']
const colors: Record<PlantTrialStage, string> = { delivery: '#ef9c96', transfer: '#ffc16e', pot: '#bfa8ed', finish: '#7de3ef', success: '#7de3bf', unsettled: '#9aa9a4' }
export default function PlantFailureComparison({ prepared, result, hidden, busy }: { prepared: PreparedRound; result: RoundAnalysis | null; hidden: boolean; busy: boolean }) {
  const [prediction, setPrediction] = useState<PlantFailureLink | null>(null), [retry, setRetry] = useState(false)
  const option = prepared.balls.find(b => b.ballId === prepared.scenario.plant!.ballId)!.options[0]
  const shot = result?.candidates.find(s => s.plan.id === option.id), summary = shot ? plantFailureSummary(shot) : null
  const revealed = Boolean(result) && !retry
  const limiting = summary?.limiting.map(key => PLANT_STAGE_LABELS[key]).join(' and ')
  const feedback = summary?.limiting.length
    ? `${summary.limiting.length > 1 ? 'Tied largest losses' : 'Largest loss'}: ${limiting}.`
    : summary?.counts.unsettled ? 'No classified link failures; unsettled trials remain unresolved.' : 'No failed links in this sample.'
  return <section className="lesson-comparison plant-failure-comparison" aria-label="Plant failure-link comparison" hidden={hidden}>
    <h3>Which link limits this plant?</h3>
    <p>For plant finish {option.label}, predict which link loses the most scoring trials for your player: first delivery, 1 → 2 transfer, target pot, or cue-ball finish.</p>
    <div role="group" className="lesson-predictions" aria-label="Failure-link prediction">{PLANT_FAILURE_LINKS.map(key => <Button key={key} size="sm" variant={prediction === key ? 'default' : 'outline'} aria-pressed={prediction === key} disabled={busy || revealed} onClick={() => setPrediction(key)}>{PLANT_STAGE_LABELS[key]}</Button>)}</div>
    {revealed && summary && <>
      <p role="status"><strong>{prediction && summary.limiting.includes(prediction) ? 'Your prediction matches a largest sampled loss. ' : ''}{feedback}</strong></p>
      <p>{result?.selected.plan.id === option.id ? `You chose reference plant finish ${option.label}.` : `You chose another stroke; this breakdown uses plant finish ${option.label}.`} The counts below reuse its {summary.trials} scoring trials.</p>
      <figure><figcaption><strong>One category per trial</strong></figcaption>
        <svg viewBox="0 0 300 30" role="img" aria-label={`Plant finish ${option.label}: first-failure and success counts`}>
          {stages.map((key, i) => {
            const before = stages.slice(0, i).reduce((sum, previous) => sum + summary.counts[previous], 0)
            return <rect key={key} data-testid={`failure-bar-${key}`} x={before / summary.trials * 300} y="2" width={summary.counts[key] / summary.trials * 300} height="26" fill={colors[key]}><title>{PLANT_STAGE_LABELS[key]}: {summary.counts[key]} of {summary.trials}</title></rect>
          })}
        </svg>
      </figure>
      <table><caption>Reference plant finish {option.label} · All trials</caption><thead><tr><th>First failure / result</th><th>Trials</th></tr></thead><tbody>{stages.map(key => <tr key={key} data-testid={`failure-row-${key}`}><th><span aria-hidden="true" style={{ color: colors[key] }}>● </span>{PLANT_STAGE_LABELS[key]}</th><td>{summary.counts[key]}/{summary.trials}</td></tr>)}</tbody></table>
      <ol>
        <li><strong>First delivery:</strong> the cue did not contact ball 1 first.</li>
        <li><strong>1 → 2 transfer:</strong> delivery reached ball 1, but no subsequent ball-1/ball-2 contact was recorded.</li>
        <li><strong>Target pot:</strong> both contacts occurred, but ball 2 stayed on the table.</li>
        <li><strong>Cue-ball finish:</strong> both contacts and the target pot occurred, but the complete stroke failed, including a scratch or a finish outside the required position tolerance.</li>
      </ol>
      <p>Failures are assigned to the first failed observed link, not counted again at later links. A target miss with a scratch therefore counts under target pot, not finish. Complete success uses the existing scoring rule. Trials that did not settle are kept separate rather than diagnosed as a miss.</p>
      <p>{summary.counts.unsettled ? `${summary.counts.unsettled} unsettled trials are unresolved; the largest classified loss is not a complete explanation of every failure.` : 'All trials settled.'} These are counts out of all trials, not conditional failure rates among attempts that reached each link.</p>
      <details><summary>Compare complete success for all offered strokes</summary>
        <table><thead><tr><th>Route / finish</th><th>Successes</th></tr></thead><tbody>{prepared.balls.flatMap(ball => ball.options.map(o => {
          const candidate = result!.candidates.find(c => c.plan.id === o.id)!
          return <tr key={o.id} data-testid={`failure-choice-${o.id}`}><th>{ball.ballId === prepared.scenario.plant!.ballId ? 'Plant' : `Free ${ball.ballId}`} · {o.label}</th><td>{candidate.trialSuccesses?.filter(Boolean).length ?? Math.round(candidate.successRate * candidate.samples)}/{candidate.samples}</td></tr>
        }))}</tbody></table>
      </details>
      <p>All choices use the same indexed stroke-error draws for your player. This panel adds no simulations and changes no scores. The largest failure count describes this finish in this finite sample; it does not prove a universal weakness or the benefit of a particular adjustment. Ties are retained, and other finishes or player talents can change which link dominates.</p>
      <Button size="sm" variant="outline" onClick={() => { setRetry(true); setPrediction(null) }}>Try the prediction again</Button>
    </>}
    {revealed && !summary && <p role="status">The trial breakdown could not be verified for this result.</p>}
    {result && retry && <Button size="sm" onClick={() => setRetry(false)}>Check prediction</Button>}
    <p className="lesson-comparison-note">This prediction is optional and never blocks advancement.</p>
  </section>
}
