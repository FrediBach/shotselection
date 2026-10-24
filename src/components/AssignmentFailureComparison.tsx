import { useState } from 'react'
import { Button } from './ui/button'
import { ASSIGNMENT_CONDITIONS, assignmentFailureSummary } from '../engine/assignment-failure'
import type { PreparedRound, RoundAnalysis } from '../engine/types'
export default function AssignmentFailureComparison({ prepared, result, hidden, busy }: { prepared: PreparedRound; result: RoundAnalysis | null; hidden: boolean; busy: boolean }) {
  const [reference, setReference] = useState(0), [predictions, setPredictions] = useState<Record<number, number>>({}), [retry, setRetry] = useState(false)
  const options = prepared.balls[0].options, option = options[reference]
  const shot = result?.candidates.find(s => s.plan.id === option.id), summary = shot ? assignmentFailureSummary(shot) : null
  const revealed = Boolean(result) && !retry
  const conditions = (mask: number) => ASSIGNMENT_CONDITIONS.filter((_, i) => mask & (1 << i)).join(' + ')
  return <section className="lesson-comparison plant-quality-comparison" aria-label="Assignment failure comparison" hidden={hidden}>
    <h3>Which requirement fails most often?</h3>
    <p>Inspect each stroke and predict its weakest condition. Stroke C deliberately aims slightly away from the potting line. All three are scored honestly, including nominal misses.</p>
    <div role="group" aria-label="Diagnostic stroke" className="lesson-predictions">{options.map((o, i) => <Button key={o.id} size="sm" variant={reference === i ? 'default' : 'outline'} aria-pressed={reference === i} onClick={() => setReference(i)}>Inspect {o.label}</Button>)}</div>
    <p>Reference stroke {option.label}. {result && result.selected.plan.id !== option.id ? 'This is a diagnostic reference, separate from your selected stroke.' : ''} Which condition will fail on the most trials? Each count uses all trials as its denominator.</p>
    <div role="group" aria-label="Assignment prediction" className="lesson-predictions">{ASSIGNMENT_CONDITIONS.map((label, i) => <Button key={label} size="sm" variant={predictions[reference] === i ? 'default' : 'outline'} aria-pressed={predictions[reference] === i} disabled={busy || revealed} onClick={() => setPredictions(p => ({ ...p, [reference]: i }))}>{label}</Button>)}</div>
    {revealed && summary && shot && <>
      <p role="status">{summary.limiting.includes(predictions[reference]) ? 'Your prediction matches. ' : ''}{summary.limiting.length ? `Most frequent failed condition${summary.limiting.length > 1 ? 's (tied)' : ''}: ${summary.limiting.map(i => ASSIGNMENT_CONDITIONS[i]).join(' and ')}.` : 'No failed conditions in this sample.'}</p>
      <table><caption>Stroke {option.label} · Overlapping failures</caption><thead><tr><th>Requirement</th><th>Failed / all trials</th></tr></thead><tbody>{ASSIGNMENT_CONDITIONS.map((name, i) => <tr key={name} data-testid={`assignment-failure-${i}`}><th>{name}</th><td>{summary.failures[i]}/{shot.samples}</td></tr>)}<tr><th>Any requirement failed</th><td>{summary.failedTrials}/{shot.samples}</td></tr><tr><th>Complete successes</th><td>{summary.combinations[0]}/{shot.samples}</td></tr></tbody></table>
      <p data-testid="assignment-overlap">Adding the three failure counts gives {summary.sum}, but only {summary.failedTrials} distinct trials failed. The difference of {summary.sum - summary.failedTrials} counts repeats trials that failed multiple conditions. Never subtract the sum from the trial total to estimate success.</p>
      <details><summary>See the overlap: one row per exact combination</summary><table><thead><tr><th>Failed conditions</th><th>Trials</th></tr></thead><tbody>{summary.combinations.map((count, mask) => <tr key={mask} data-testid={`assignment-combination-${mask}`}><th>{mask ? conditions(mask) : 'None — complete success'}</th><td>{count}/{shot.samples}</td></tr>)}</tbody></table><p>These eight disjoint rows add to {shot.samples}. The three condition rows above overlap.</p></details>
      <p><strong>Legal pot:</strong> a settled, foul-free first pot. <strong>Landing zone:</strong> a settled cue ball inside the shared zone without scratching, whether or not the opener went in. <strong>Next-shot access:</strong> a clear direct route from the actual settled balls within the allowed cut angle; this is a geometry check, not a simulated second-pot probability.</p>
      <p>Complete success is the intersection of all three conditions on the same trial. A scratch or unsettled trial can fail several conditions together. The largest count describes this finite sample; it does not identify an independent cause or guarantee that fixing it fixes the assignment. Other players or samples can change the weakest condition or produce ties.</p>
      <Button size="sm" variant="outline" onClick={() => { setRetry(true); setPredictions({}); setReference(0) }}>Try the predictions again</Button>
    </>}
    {revealed && !summary && <p role="status">The assignment breakdown could not be verified.</p>}
    {result && retry && <Button size="sm" onClick={() => setRetry(false)}>Check predictions</Button>}
    <p className="lesson-comparison-note">Predictions are optional and never block advancement. These counts reuse the scoring trials and change no scores.</p>
  </section>
}
