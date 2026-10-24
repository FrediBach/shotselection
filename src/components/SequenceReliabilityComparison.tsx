import { useMemo, useState } from 'react'
import { Button } from './ui/button'
import SequenceDiagram from './SequenceDiagram'
import { sequenceLayout } from '../engine/sequence-reliability'
import { simulateShot } from '../engine/physics'
import { directShotGeometry } from '../engine/shot-geometry'
import type { PreparedRound, RoundAnalysis } from '../engine/types'

const percent = (n: number) => `${Math.round(n * 100)}%`
export default function SequenceReliabilityComparison({ prepared, result, hidden, busy }: { prepared: PreparedRound; result: RoundAnalysis | null; hidden: boolean; busy: boolean }) {
  const [prediction, setPrediction] = useState<number | null>(null)
  const [retry, setRetry] = useState(false)
  const comparison = prepared.sequenceComparison!
  const reference = prepared.balls[0].options.find(o => o.id === comparison.referenceId)!
  const start = useMemo(() => sequenceLayout(prepared.scenario, simulateShot(prepared.scenario, reference.plan, { record: false })), [prepared, reference])
  const evidence = result?.sequenceComparison
  const revealed = Boolean(result) && !retry
  const orderName = (first: number) => first === 2 ? '2 → 3' : '3 → 2'
  const ranked = evidence ? [...evidence.orders].sort((a, b) => b.completed - a.completed) : []
  const close = evidence ? ranked[0].completionRate - ranked[1].completionRate < .05 : false
  return <section className="lesson-comparison" aria-label="Sequence reliability" hidden={hidden}>
    <h3>Which order finishes both balls?</h3>
    <p>Compare 2 → 3 with 3 → 2 from the same finish after reference stroke {reference.label} pots ball 1. Both orders work nominally. Predict which completes both pots more often when stroke errors are included.</p>
    <figure><figcaption>Shared reference finish · stroke {reference.label}</figcaption><SequenceDiagram balls={start.balls} label="Shared starting layout for the two-shot trials" /></figure>
    <p>A high first-pot rate can hide a weaker continuation. Check the entire connection before choosing.</p>
    <div className="lesson-predictions" role="group" aria-label="Sequence prediction">{comparison.orders.map(order => <Button key={order.first.ballId} size="sm" variant={prediction === order.first.ballId ? 'default' : 'outline'} aria-pressed={prediction === order.first.ballId} disabled={busy || revealed} onClick={() => setPrediction(order.first.ballId)}>Order {orderName(order.first.ballId)}</Button>)}</div>
    {revealed && evidence && <>
      <p role="status"><strong>{close ? 'The sampled completion rates are close; inspect the counts.' : prediction === null ? `Order ${orderName(ranked[0].order.first.ballId)} completes more often in this sample.` : prediction === ranked[0].order.first.ballId ? 'Your prediction matches the higher sampled completion rate.' : 'The first pot alone does not decide the order. Compare the completed two-shot trials.'}</strong></p>
      <p>Your selected opener {result!.selected.plan.id === reference.id ? 'is the reference stroke, so these trials start at its nominal finish.' : `differs from reference stroke ${reference.label}; these trials use the reference finish, not your selected finish.`}</p>
      {evidence.orders.map(branch => {
        const firstGeometry = directShotGeometry(evidence.scenario, branch.order.first)
        const secondGeometry = directShotGeometry(branch.secondScenario, branch.order.second)
        return <div className="sequence-rate-branch" key={branch.order.first.ballId}>
          <h4>Order {orderName(branch.order.first.ballId)}</h4>
          <dl className="geometry-measures">
            <div><dt>Nominal first cut</dt><dd>{firstGeometry.cutDegrees.toFixed(1)}°</dd></div>
            <div><dt>Nominal second cut</dt><dd>{secondGeometry.cutDegrees.toFixed(1)}°</dd></div>
            <div><dt>Nominal second approach</dt><dd>{secondGeometry.cueDistance.toFixed(2)} m</dd></div>
            <div><dt>First legal pots</dt><dd>{branch.firstLegal}/{evidence.samples} · {percent(branch.firstRate)}</dd></div>
            <div><dt>Planned second route retained</dt><dd>{branch.firstLegal ? `${branch.secondAvailable}/${branch.firstLegal}` : 'No legal first pots'}</dd></div>
            <div><dt>Complete after a legal first pot</dt><dd>{branch.continuationRate === null ? 'No legal first pots' : `${branch.completed}/${branch.firstLegal} · ${percent(branch.continuationRate)}`}</dd></div>
            <div><dt>Both pots completed</dt><dd>{branch.completed}/{evidence.samples} · {percent(branch.completionRate)}</dd></div>
          </dl>
          <meter aria-label={`Order ${orderName(branch.order.first.ballId)} completion count`} min={0} max={evidence.samples} value={branch.completed} style={{ width: '100%' }} />
          <figure><figcaption>Nominal first pot: ball {branch.order.first.ballId}</figcaption><SequenceDiagram balls={evidence.scenario.balls} simulation={branch.firstNominal} label={`Order ${orderName(branch.order.first.ballId)}: nominal first pot`} /></figure>
          <figure><figcaption>Nominal second pot: ball {branch.order.second.ballId}</figcaption><SequenceDiagram balls={branch.secondScenario.balls} simulation={branch.secondNominal} label={`Order ${orderName(branch.order.first.ballId)}: nominal second pot`} /></figure>
          <p className="lesson-comparison-note">Planned strokes: {[branch.order.first, branch.order.second].map(plan => `ball ${plan.ballId} at ${plan.speed.toFixed(2)} m/s with ${plan.topSpin < 0 ? `${Math.round(Math.abs(plan.topSpin) * 100)}% draw` : plan.topSpin > 0 ? 'natural-roll follow' : 'center ball'}`).join('; ')}. Neither plan uses English.</p>
        </div>
      })}
      <p>Each order uses {evidence.samples} two-shot trials with your player’s aim, strength, spin and English errors. Both orders receive the same trial error draws, with a separate draw for each shot. A miss, foul or scratch on the first shot ends that trial.</p>
      <p>The second shot starts from the actual settled balls in each successful first-shot trial. It re-aims at its planned pocket within the {evidence.cutLimit}° cut limit, keeping the planned pace and spin. A lost route counts as a failed continuation. The conditional rate includes those losses; the overall rate counts both legal pots out of all {evidence.samples} trials.</p>
      <p className="lesson-comparison-note">These are finite-sample estimates for these fixed plans and this response to position errors. They exclude uncertainty in the reference opener and do not rank every possible order or adjustment. The diagrams show nominal shots; trial finishes vary. The regular opening score remains separate from this sequence prediction.</p>
      <Button size="sm" variant="outline" onClick={() => { setPrediction(null); setRetry(true) }}>Try the sequence prediction again</Button>
    </>}
    {revealed && !evidence && <p role="status">The two-shot trial results are unavailable for this round.</p>}
    {result && retry && <Button size="sm" onClick={() => setRetry(false)}>Check sequence prediction</Button>}
    <p className="lesson-comparison-note">Your prediction is optional and never blocks advancement.</p>
  </section>
}
