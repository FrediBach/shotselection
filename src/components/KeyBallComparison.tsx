import { useMemo, useState } from 'react'
import { Button } from './ui/button'
import { keyBallEvidence, KEY_BALL_TARGET_CUT } from '../engine/key-ball'
import Diagram from './SequenceDiagram'
import type { PreparedRound, RoundAnalysis } from '../engine/types'


export default function KeyBallComparison({ prepared, result, busy, hidden }: { prepared: PreparedRound; result: RoundAnalysis | null; busy: boolean; hidden: boolean }) {
  const [prediction, setPrediction] = useState<string | null>(null)
  const [retry, setRetry] = useState(false)
  const [restore, setRestore] = useState(false)
  const evidence = useMemo(() => result ? result.candidates.map(shot => ({ shot, check: keyBallEvidence(prepared.scenario, shot.plan, shot.nominal) })) : [], [prepared, result])
  const revealed = Boolean(result) && !retry
  const kept = evidence.find(e => e.check.kept), lost = evidence.find(e => e.check.lost)
  const proof = kept?.check.continuation
  const selected = evidence.find(e => e.shot.plan.id === result?.selected.plan.id)
  return <section className="lesson-comparison" aria-label="Key-ball preservation" hidden={hidden}>
    <h3>Keep the link to ball 3.</h3>
    <p>Which stroke preserves ball 2 as a stepping stone to ball 3? Predict before locking in the opener.</p>
    <div className="lesson-predictions" role="group" aria-label="Key-ball prediction">{prepared.balls[0].options.map(option => <Button key={option.id} size="sm" variant={prediction === option.id ? 'default' : 'outline'} aria-pressed={prediction === option.id} disabled={busy || revealed} onClick={() => setPrediction(option.id)}>Stroke {option.label}</Button>)}</div>
    {revealed && <div>
      <p role="status"><strong>{prediction === null ? 'Compare the preserved and displaced key ball.' : prediction === kept?.shot.plan.id ? 'Your prediction preserves the key-ball connection.' : 'The preserved ball must also provide the next position. Compare the two continuations.'}</strong></p>
      <p>Your selected stroke: {selected?.check.kept ? 'preserves a verified 1 → 2 → 3 continuation.' : selected?.check.lost ? 'pots ball 1, but displaces the key ball and loses the connection.' : 'is not the demonstrated preservation alternative; inspect its finish in the results.'}</p>
      {[kept, lost].filter(e => e !== undefined).map(entry => <figure key={entry.shot.plan.id}>
        <figcaption><strong>{entry.shot.plan.label}</strong> · {entry.check.kept ? 'Key ball preserved' : 'Key ball displaced'}</figcaption>
        <Diagram balls={entry.shot.nominal.finalBalls.filter(ball => !ball.pocketed)} label={`${entry.check.kept ? 'Preserved' : 'Displaced'} key ball after the opening pot`} oldKey={prepared.scenario.balls.find(ball => ball.id === 2)!.position} />
        <dl className="geometry-measures">
          <div><dt>Legal opening pot</dt><dd>{entry.check.legalPot ? 'Yes' : 'No'}</dd></div>
          <div><dt>Ball 2 displacement</dt><dd>{((entry.check.moved ?? 0) * 100).toFixed(1)} cm</dd></div>
          <div><dt>Routes to ball 2 (≤{prepared.scenario.objective!.maxCutAngle}°)</dt><dd>{entry.check.keyRoutes.length}</dd></div>
          <div><dt>Direct routes to ball 3 (≤{KEY_BALL_TARGET_CUT}°)</dt><dd>{entry.check.directTargetRoutes.length}</dd></div>
        </dl>
      </figure>)}
      <p>The diagrams show actual settled positions. The pink ring marks ball 2’s original position; the dashed line shows displacement, not its travelled path. Neither finish offers a direct shot to ball 3 within the {KEY_BALL_TARGET_CUT}° cut limit. Ball 2 is the only intermediate ball left.</p>
      {proof && <>
        <h4>The preserved continuation</h4>
        <figure><figcaption>Pot ball 2 and reach ball 3</figcaption><Diagram balls={proof.scenario.balls} simulation={proof.simulation} label="Simulated second shot from the preserved opening finish" /></figure>
        <figure><figcaption>Pot ball 3 from a {proof.thirdCut.toFixed(0)}° cut</figcaption><Diagram balls={proof.thirdScenario.balls} simulation={proof.thirdSimulation} label="Simulated third pot after using the key ball" /></figure>
        <p>Both follow-up pots were simulated from the preceding settled state without a scratch. White is the starting cue ball; cyan traces its path and finish; gold traces the ball being potted.</p>
      </>}
      {lost?.check.restoration && <>
        <Button size="sm" variant="outline" aria-expanded={restore} onClick={() => setRestore(value => !value)}>{restore ? 'Hide restoration check' : 'Why did the connection disappear?'}</Button>
        {restore && <div>
          <p><strong>Counterfactual: restore only ball 2.</strong> Keep the lost stroke’s cue-ball finish and every other ball fixed. Returning ball 2 to its original position restores a simulated 2 → 3 continuation. Its displacement caused the lost connection under these route limits.</p>
          <Diagram balls={lost.check.restoration.scenario.balls} simulation={lost.check.restoration.simulation} label="Counterfactual continuation with only ball 2 restored" />
          <p>The restored second shot leaves a {lost.check.restoration.thirdCut.toFixed(0)}° cut on ball 3, and the third pot also succeeds in simulation. This restored layout is an explanation, not the actual result.</p>
        </div>}
      </>}
      <p className="lesson-comparison-note">The regular score still measures the opening pot, zone and access to ball 2. This separate check demonstrates one nominal continuation, not a sequence success rate. “Easy” means a direct cut of {KEY_BALL_TARGET_CUT}° or less; other, harder shots may exist.</p>
      <Button size="sm" variant="outline" onClick={() => { setRetry(true); setPrediction(null); setRestore(false) }}>Try the prediction again</Button>
    </div>}
    {result && retry && <Button size="sm" onClick={() => setRetry(false)}>Check prediction</Button>}
    <p className="lesson-comparison-note">This prediction is optional and never blocks advancement.</p>
  </section>
}
