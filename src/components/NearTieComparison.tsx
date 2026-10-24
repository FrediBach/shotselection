import { useState } from 'react'
import { closestSuccessPair } from '@/engine/near-tie'
import type { RoundAnalysis } from '@/engine/types'
import { Button } from './ui/button'

export default function NearTieComparison({ result }: { result: RoundAnalysis | null }) {
  const [answer, setAnswer] = useState<boolean | null>(null)
  if (!result) return <section className="lesson-comparison" aria-label="Near-tie comparison"><h3>How much evidence is enough?</h3><p>After your shot, compare two close success rates under the same stroke-error draws. A small sampled lead may disappear in another set of trials.</p></section>
  const pair = closestSuccessPair(result.candidates)
  if (!pair) return <section className="lesson-comparison" aria-label="Near-tie comparison"><p>This run did not produce two viable choices with paired trial data. Compare the observed outcomes without claiming a near tie.</p></section>
  const { a, b, evidence } = pair
  return <section className="lesson-comparison" aria-label="Near-tie comparison">
    <h3>Read a small sampled gap</h3>
    <p>{evidence.gap <= .05 ? 'These two viable choices have close measured success rates.' : 'These are the closest viable choices in this run; their rates are farther apart than the intended near-tie example.'} Both use the same indexed stroke errors.</p>
    <dl className="geometry-measures">{[a, b].map(shot => <div key={shot.plan.id}><dt>{shot.plan.label}</dt><dd>{shot.trialSuccesses!.filter(Boolean).length} / {shot.samples}</dd></div>)}</dl>
    <p>Do these matched trials establish a difference in complete success rate?</p>
    <div className="lesson-predictions" role="group" aria-label="Near-tie judgment">{[false, true].map(value => <Button key={String(value)} size="sm" variant={answer === value ? 'default' : 'outline'} disabled={answer !== null} aria-pressed={answer === value} onClick={() => setAnswer(value)}>{value ? 'Evidence of a difference' : 'Too little evidence'}</Button>)}</div>
    {answer !== null && <div aria-live="polite">
      <p><strong>{answer === evidence.clearDifference ? 'That matches the paired evidence.' : 'Check the matched outcomes again.'}</strong> Only the first stroke succeeds in {evidence.aOnly} trials; only the second succeeds in {evidence.bOnly}. They agree in the other {evidence.same} trials.</p>
      <p>{evidence.clearDifference ? 'This sample provides evidence of a success-rate difference under the simulated error model.' : 'This sample does not establish a success-rate advantage. That does not prove the strokes have identical chances.'} The game score also rewards finish quality; this comparison addresses success rate only.</p>
      <details className="result-details"><summary>How the comparison works</summary><p>We compare the trials where the two outcomes differ using an exact two-sided paired binomial test (p = {evidence.pValue.toFixed(3)}, threshold 0.05). Candidates share error draws, so treating their trials as unrelated would ignore that pairing. This is a selected teaching example, not a corrected test of every possible pair or a guarantee about real play.</p></details>
      <Button variant="outline" size="sm" onClick={() => setAnswer(null)}>Try the judgment again</Button>
    </div>}
    <p className="lesson-comparison-note">This check never blocks advancement.</p>
  </section>
}
