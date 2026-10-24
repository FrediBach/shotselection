import { useMemo, useState } from 'react'
import { Button } from './ui/button'
import SequenceDiagram from './SequenceDiagram'
import { steppingStoneEvidence } from '../engine/stepping-stone'
import { simulateShot } from '../engine/physics'
import { directShotGeometry } from '../engine/shot-geometry'
import type { PreparedRound, RoundAnalysis } from '../engine/types'

export default function SteppingStoneComparison({ prepared, result, hidden, busy }: { prepared: PreparedRound; result: RoundAnalysis | null; hidden: boolean; busy: boolean }) {
  const [prediction, setPrediction] = useState<'direct' | 'via' | null>(null)
  const [retry, setRetry] = useState(false)
  const reference = prepared.balls[0].options.find(o => o.id === prepared.steppingStoneOptionId)!
  const evidence = useMemo(() => steppingStoneEvidence(prepared.scenario, result?.candidates.find(s => s.plan.id === prepared.steppingStoneOptionId)?.nominal ?? simulateShot(prepared.scenario, reference.plan, { record: false })), [prepared, reference, result])
  const revealed = Boolean(result) && !retry
  return <section className="lesson-comparison" aria-label="Stepping-stone comparison" hidden={hidden}>
    <h3>Go straight to the distant ball?</h3>
    <p>Compare orders 2 → 3 and 3 → 2. Which uses the nearer ball to leave a shorter, fuller shot on distant ball 2?</p>
    <p>Both orders start from the same nominal finish after reference stroke {reference.label} pots ball 1. This reference stays the same whichever opening stroke you choose for your score.</p>
    {evidence && <>
      <figure><figcaption>Shared starting layout after stroke {reference.label}</figcaption><SequenceDiagram balls={evidence.scenario.balls} label="Shared settled layout for both orders" /></figure>
      <p>From this cue position, ball 2 is {evidence.farDistance.toFixed(2)} m away and ball 3 is {evidence.nearDistance.toFixed(2)} m away (center to center).</p>
    </>}
    <div className="lesson-predictions" role="group" aria-label="Order prediction">{(['direct', 'via'] as const).map(order => <Button key={order} size="sm" variant={prediction === order ? 'default' : 'outline'} aria-pressed={prediction === order} disabled={busy || revealed} onClick={() => setPrediction(order)}>{order === 'direct' ? '2 → 3: distant first' : '3 → 2: nearer first'}</Button>)}</div>
    {revealed && evidence && <>
      <p role="status"><strong>{prediction === null ? 'Compare both completed orders.' : prediction === 'via' ? 'Your prediction uses ball 3 as the stepping stone.' : 'Distant first works here too. Compare the shorter, fuller shot on ball 2 after using ball 3.'}</strong></p>
      <p>Your selected opener {result!.selected.plan.id === reference.id ? `is reference stroke ${reference.label}, so these sequences use its actual nominal finish.` : `is different from reference stroke ${reference.label}; these sequences do not describe your selected finish.`}</p>
      {(['direct', 'via'] as const).map(order => {
        const branch = evidence[order]
        const targetShot = order === 'direct' ? branch.first : branch.final
        return <div className="stepping-stone-branch" key={order}>
          <h4>{order === 'direct' ? '2 → 3 · distant ball first' : '3 → 2 · use the nearer ball'}</h4>
          <dl className="geometry-measures">
            <div><dt>Legal pots, no scratch</dt><dd>2 of 2</dd></div>
            <div><dt>Approach to ball 2’s contact point</dt><dd>{(order === 'direct' ? evidence.directApproach : evidence.viaApproach).toFixed(2)} m</dd></div>
            <div><dt>Cut on ball 2</dt><dd>{targetShot.route.cutAngle.toFixed(1)}°</dd></div>
          </dl>
          {[branch.first, branch.final].map((shot, i) => <figure key={i}>
            <figcaption>Pot {shot.plan.ballId} {i === 0 ? 'first' : 'next'} · {shot.route.cutAngle.toFixed(1)}° cut · {directShotGeometry(shot.scenario, shot.plan).cueDistance.toFixed(2)} m approach</figcaption>
            <SequenceDiagram balls={shot.scenario.balls} simulation={shot.simulation} label={`${order === 'direct' ? 'Distant-first' : 'Nearer-first'} order: simulated pot on ball ${shot.plan.ballId}`} />
            <p className="lesson-comparison-note">{shot.plan.speed.toFixed(2)} m/s, {shot.plan.topSpin < 0 ? `${Math.round(Math.abs(shot.plan.topSpin) * 100)}% draw` : shot.plan.topSpin > 0 ? 'natural-roll follow' : 'center ball'}, no English.</p>
          </figure>)}
        </div>
      })}
      <p>Both orders legally pot both balls. Using ball 3 first shortens the approach to ball 2 by at least 30 cm and reduces its cut by at least 8°, to the same pocket with ball 2 still in place. The extra position shot creates the better geometry; merely choosing a nearer ball would not prove this.</p>
      <p>Each shot begins at the preceding shot’s exact settled layout, with every remaining ball retained. White is the starting cue ball, cyan its path and finish, and gold the object-ball path.</p>
      <p className="lesson-comparison-note">These are two demonstrated sequences, not a ranking of every possible stroke or a combined success probability. Their pace and spin may differ. A shorter, fuller shot alone does not prove that the whole order is more reliable. The regular score still checks the opening pot, zone and access to ball 2.</p>
      <Button size="sm" variant="outline" onClick={() => { setPrediction(null); setRetry(true) }}>Try the order prediction again</Button>
    </>}
    {revealed && !evidence && <p role="status">Both complete orders could not be verified for this reference finish.</p>}
    {result && retry && <Button size="sm" onClick={() => setRetry(false)}>Check order prediction</Button>}
    <p className="lesson-comparison-note">The prediction is optional and never blocks advancement.</p>
  </section>
}
