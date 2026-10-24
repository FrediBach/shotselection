import { useMemo, useState } from 'react'
import { Button } from './ui/button'
import SequenceDiagram from './SequenceDiagram'
import { collisionAssistancePairFinder, collisionTrialSummary } from '../engine/collision-assistance'
import { distance } from '../engine/math'
import type { PreparedRound, RoundAnalysis } from '../engine/types'

const rate = (n: number, total: number) => total ? `${n}/${total} · ${Math.round(n / total * 100)}%` : 'No trials'
export default function CollisionAssistanceComparison({ prepared, result, hidden, busy }: { prepared: PreparedRound; result: RoundAnalysis | null; hidden: boolean; busy: boolean }) {
  const [prediction, setPrediction] = useState<string | null>(null), [retry, setRetry] = useState(false), [removed, setRemoved] = useState(false)
  const contrast = prepared.collisionAssistance!
  const options = prepared.balls[0].options.filter(o => [contrast.assistedId, contrast.clearId].includes(o.id))
  const pair = useMemo(() => result ? collisionAssistancePairFinder(prepared.scenario)(result.candidates.filter(s => [contrast.assistedId, contrast.clearId].includes(s.plan.id)).map(s => ({ plan: s.plan, simulation: s.nominal }))) : null, [prepared, result, contrast])
  const branches = options.map(option => { const shot = result?.candidates.find(s => s.plan.id === option.id); return { option, shot, counts: shot ? collisionTrialSummary(shot) : null } })
  const ranked = [...branches].sort((a, b) => (b.counts?.successes ?? 0) - (a.counts?.successes ?? 0))
  const close = result && branches.every(b => b.counts) && Math.abs(ranked[0].counts!.successes - ranked[1].counts!.successes) / result.samples < .05
  const revealed = Boolean(result) && !retry
  const zone = { target: prepared.scenario.objective!.target!, radius: prepared.scenario.objective!.radius }
  return <section className="lesson-comparison" aria-label="Collision assistance comparison" hidden={hidden}>
    <h3>Will the helping nudge repeat?</h3>
    <p>Strokes {options.map(o => o.label).join(' and ')} both pot ball 1 into the same pocket, finish in the shared zone and leave ball 2 available. Which succeeds more often when your player’s stroke errors are included?</p>
    <div className="lesson-predictions" role="group" aria-label="Collision reliability prediction">{options.map(o => <Button key={o.id} size="sm" variant={prediction === o.id ? 'default' : 'outline'} aria-pressed={prediction === o.id} disabled={busy || revealed} onClick={() => setPrediction(o.id)}>Stroke {o.label}</Button>)}</div>
    {revealed && pair && branches.every(b => b.counts) && <>
      <p role="status"><strong>{close ? 'The sampled success rates are close; inspect the counts.' : prediction === null ? `Stroke ${ranked[0].option.label} succeeds more often in this sample.` : prediction === ranked[0].option.id ? 'Your prediction matches the higher sampled success rate.' : 'The other stroke succeeds more often in this sample.'}</strong></p>
      <p>Your selected stroke {result!.selected.plan.id === contrast.assistedId ? 'is the collision-assisted reference.' : result!.selected.plan.id === contrast.clearId ? 'is the clean reference.' : 'is the third alternative; this comparison uses the other two strokes.'}</p>
      {branches.map(({ option, counts }) => {
        const assisted = option.id === contrast.assistedId
        return <figure key={option.id}>
          <figcaption><strong>Stroke {option.label} · {assisted ? 'Collision-assisted' : 'Clean route'}</strong></figcaption>
          <SequenceDiagram balls={prepared.scenario.balls} simulation={assisted ? pair.graze.traced : pair.clean.traced} zone={zone} label={`Stroke ${option.label}: ${assisted ? 'assisted' : 'clean'} nominal success in the shared zone`} />
          <p>{assisted ? 'After contacting ball 1, the cue contacts ball 3 and is redirected into the landing zone.' : `The cue passes ball 3 with ${(pair.clean.clearance * 1000).toFixed(1)} mm of minimum surface clearance and no secondary ball contact.`}</p>
          <dl className="geometry-measures" aria-label={`Stroke ${option.label} trial counts`}>
            <div><dt>Trials contacting ball 3</dt><dd>{rate(counts!.withContact, counts!.trials)}</dd></div>
            <div><dt>Complete successes</dt><dd>{rate(counts!.successes, counts!.trials)}</dd></div>
            <div><dt>Success when contact occurred</dt><dd>{rate(counts!.successfulContacts, counts!.withContact)}</dd></div>
            <div><dt>Success without contact</dt><dd>{rate(counts!.successfulClear, counts!.withoutContact)}</dd></div>
          </dl>
          <meter aria-label={`Stroke ${option.label} complete successes`} min={0} max={counts!.trials} value={counts!.successes} style={{ width: '100%' }} />
        </figure>
      })}
      <p>Complete success means a legal opening pot, a finish inside the shared zone and a clear next route within {prepared.scenario.objective!.maxCutAngle}°. It does not execute the next shot. Contact means any cue/ball-3 collision during the trial, including trials that miss, scratch or fail to settle.</p>
      <p>Each stroke uses the same {result!.samples} error draws for your player’s aim, strength, spin and English. All trials count in the first two rows. The last two rows use only their named contact group; “No trials” means that group did not occur. The diagrams show starting balls and nominal paths, with the shared landing zone outlined.</p>
      <Button size="sm" variant="outline" aria-expanded={removed} onClick={() => setRemoved(v => !v)}>{removed ? 'Hide the fixed-stroke comparison' : 'Repeat the assisted stroke without ball 3'}</Button>
      {removed && <>
        <p><strong>Nominal diagnostic: remove only ball 3.</strong> Keep every other starting ball, the shared zone and all stroke controls fixed. Ball 1 is still legally potted without a scratch, but the cue finishes {(distance(pair.graze.counterfactual.cueEnd, zone.target) * 100).toFixed(1)} cm from the zone center, outside its {(zone.radius * 100).toFixed(1)} cm radius. This proves that the original success needed the nudge.</p>
        <SequenceDiagram balls={pair.graze.without.balls} simulation={pair.graze.counterfactual} zone={zone} label="Fixed assisted stroke with only ball 3 removed misses the zone" />
      </>}
      <p className="lesson-comparison-note">The offered strokes differ in pace and spin. Only the nominal removal diagnostic isolates the collision’s effect. Contact-group rates are descriptive, not a controlled estimate of the collision’s benefit. Finite samples may differ across players and layouts; use the measured counts rather than assuming the clean route always wins. These are the scoring trials, with no new ranking or extra trials for this panel.</p>
      <Button size="sm" variant="outline" onClick={() => { setRetry(true); setPrediction(null); setRemoved(false) }}>Try the prediction again</Button>
    </>}
    {revealed && (!pair || branches.some(b => !b.counts)) && <p role="status">The collision comparison could not be verified for this result.</p>}
    {result && retry && <Button size="sm" onClick={() => setRetry(false)}>Check prediction</Button>}
    <p className="lesson-comparison-note">This prediction is optional and never blocks advancement.</p>
  </section>
}
