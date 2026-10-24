import { useState } from 'react'
import { Button } from './ui/button'
import SequenceDiagram from './SequenceDiagram'
import { POCKETS } from '../engine/constants'
import type { PreparedRound, RoundAnalysis } from '../engine/types'
const percent = (n: number) => `${(n * 100).toFixed(1)}%`
const predictions = { over: 'Overestimates', under: 'Underestimates', same: 'Matches' }
export default function ConditionalContinuationComparison({ prepared, result, hidden, busy }: { prepared: PreparedRound; result: RoundAnalysis | null; hidden: boolean; busy: boolean }) {
  const [view, setView] = useState(1), [prediction, setPrediction] = useState<keyof typeof predictions | null>(null), [retry, setRetry] = useState(false)
  const preview = prepared.continuation!, option = prepared.balls[0].options.find(o => o.id === preview.referenceId)!, probe = preview.probes[view]
  const evidence = result?.continuation, revealed = Boolean(result) && !retry
  const labels = ['1% slower', 'Nominal', '1% faster']
  const difference = evidence && evidence.naive !== null && evidence.sequence !== null ? evidence.naive - evidence.sequence : null
  const outcome = difference === null ? null : Math.abs(difference) < 1e-9 ? 'same' : difference > 0 ? 'over' : 'under'
  return <section className="lesson-comparison plant-quality-comparison" aria-label="Conditional continuation comparison" hidden={hidden}>
    <h3>One nominal landing or the actual landings?</h3>
    <p>Reference opener {option.label} leads to ball {preview.second.ballId} at the {POCKETS.find(p => p.id === preview.second.pocketId)?.name} pocket. Compare slightly shorter and longer travel from a 1% pace change, then predict whether the nominal-product estimate overstates or understates completion.</p>
    <div role="group" aria-label="Opener pace examples" className="lesson-predictions">{labels.map((label, i) => <Button key={label} size="sm" variant={view === i ? 'default' : 'outline'} aria-pressed={view === i} onClick={() => setView(i)}>{label}</Button>)}</div>
    <figure><figcaption>Reference {option.label} · {labels[view]} · Simulated opening path</figcaption><SequenceDiagram balls={prepared.scenario.balls} simulation={probe.first} label={`Reference opener: ${labels[view]}`} /></figure>
    <p data-testid="continuation-geometry">{!probe.legal ? 'The opener fails to pot legally; no continuation is attempted.' : probe.cut === null ? 'The opener pots legally, but the fixed second-pocket route is unavailable.' : `Legal opener. Next cut: ${probe.cut.toFixed(1)}°. Cue approach: ${probe.approach!.toFixed(2)} m.`}</p>
    <p>The diagrams change only opener speed. They show simulated landings, not manually moved balls. A smaller cut is only one difficulty measure; the second shot also depends on travel and fixed pace.</p>
    <div role="group" aria-label="Nominal-product prediction" className="lesson-predictions">{(Object.keys(predictions) as (keyof typeof predictions)[]).map(key => <Button key={key} size="sm" variant={prediction === key ? 'default' : 'outline'} aria-pressed={prediction === key} disabled={busy || revealed} onClick={() => setPrediction(key)}>{predictions[key]}</Button>)}</div>
    {revealed && evidence && outcome && <>
      <p role="status">{prediction === outcome ? 'Your prediction matches. ' : ''}The nominal product {outcome === 'same' ? 'matches' : outcome === 'over' ? 'overestimates' : 'underestimates'} the sampled two-pot completion rate.</p>
      <p>{result!.selected.plan.id === preview.referenceId ? `You selected reference opener ${option.label}.` : `You selected another opener; this comparison uses reference ${option.label}.`}</p>
      <table><caption>{evidence.count} paired trials · Same second-shot errors</caption><thead><tr><th>Measure</th><th>Result</th></tr></thead><tbody>
        <tr data-testid="continuation-first"><th>Legal openers</th><td>{evidence.firstLegal}/{evidence.count}</td></tr>
        <tr data-testid="continuation-nominal"><th>Second pots from nominal landing</th><td>{evidence.nominalCompleted}/{evidence.count}</td></tr>
        <tr data-testid="continuation-available"><th>Fixed route retained after legal opener</th><td>{evidence.firstLegal ? `${evidence.available}/${evidence.firstLegal}` : 'No legal openers'}</td></tr>
        <tr data-testid="continuation-conditional"><th>Second pots after legal opener</th><td>{evidence.conditional === null ? 'Undefined: no legal openers' : `${evidence.completed}/${evidence.firstLegal} · ${percent(evidence.conditional)}`}</td></tr>
        <tr data-testid="continuation-naive"><th>Nominal product</th><td>{percent(evidence.naive!)}</td></tr>
        <tr data-testid="continuation-sequence"><th>Actual two-pot trials</th><td>{evidence.completed}/{evidence.count} · {percent(evidence.sequence!)}</td></tr>
      </tbody></table>
      <p>Nominal shortcut: ({evidence.firstLegal}/{evidence.count}) × ({evidence.nominalCompleted}/{evidence.count}) = {percent(evidence.naive!)}.</p>
      <p>{evidence.firstLegal ? `Conditional calculation: (${evidence.firstLegal}/${evidence.count}) × (${evidence.completed}/${evidence.firstLegal}) = ${evidence.completed}/${evidence.count} = ${percent(evidence.sequence!)}.` : 'With no legal openers, conditional continuation is undefined and the observed sequence completion count is zero.'}</p>
      <p>The opener outcomes are reused from its scoring trials. Each legal opener continues from all actual settled balls, including moved blockers. The second shot re-aims at the fixed pocket within the {prepared.scenario.objective!.maxCutAngle}° cut limit, keeping {preview.second.speed.toFixed(2)} m/s and the same spin controls. It does not switch pockets or optimize pace. Lost routes count as failed continuations in the conditional denominator.</p>
      <p>The second shot receives independent errors from the opener, paired between actual and nominal landings. The nominal estimate always resets to one nominal landing; the actual estimate does not. A miss, foul, scratch or unsettled opener ends the sequence without respotting.</p>
      <p>This diagnostic measures two legal pots, not the opener’s full zone assignment: a legal opener outside the zone can still continue. Ordinary points remain unchanged. Differences are finite-sample estimates for this fixed response, not proof that the nominal product always overestimates or that every player would use these controls.</p>
      <Button size="sm" variant="outline" onClick={() => { setPrediction(null); setRetry(true); setView(1) }}>Try the prediction again</Button>
    </>}
    {revealed && !evidence && <p role="status">The conditional continuation results are unavailable.</p>}
    {result && retry && <Button size="sm" onClick={() => setRetry(false)}>Check prediction</Button>}
    <p className="lesson-comparison-note">This prediction is optional and never blocks advancement.</p>
  </section>
}
