import { useMemo, useState } from 'react'
import { Button } from './ui/button'
import NextPocketDiagram from './NextPocketDiagram'
import SequenceDiagram from './SequenceDiagram'
import { openCorridorPair } from '../engine/open-corridor'
import { POCKET_GEOMETRY } from '../engine/table-geometry'
import type { PreparedRound, RoundAnalysis } from '../engine/types'

export default function OpenCorridorComparison({ prepared, result, busy }: { prepared: PreparedRound; result: RoundAnalysis | null; busy: boolean }) {
  const [prediction, setPrediction] = useState<number | null>(null), [retry, setRetry] = useState(false)
  const [proof, setProof] = useState<'actual' | 'restored' | 'removed' | null>(null)
  const contrast = prepared.openCorridor!
  const options = prepared.balls.flatMap(b => b.options)
  const opened = options.find(o => o.id === contrast.openedId)!, blocked = options.find(o => o.id === contrast.blockedId)!
  const pocket = POCKET_GEOMETRY.find(p => p.id === contrast.pocketId)!.name
  const pair = useMemo(() => result ? openCorridorPair(prepared.scenario, result.candidates.filter(s => [contrast.openedId, contrast.blockedId].includes(s.plan.id)).map(s => ({ plan: s.plan, simulation: s.nominal }))) : null, [prepared, result, contrast])
  const revealed = Boolean(result) && !retry
  return <section className="lesson-comparison" aria-label="Opening a corridor comparison">
    <h3>What does the pot remove?</h3>
    <p>Reserve ball 2 for the {pocket} pocket. Compare ball 1, finish {opened.label}, with ball 3, finish {blocked.label}. Which opening pot removes the blocker from that pocket line?</p>
    <div className="lesson-predictions" role="group" aria-label="Corridor-opening prediction">{[1, 3].map(id => <Button key={id} size="sm" variant={prediction === id ? 'default' : 'outline'} aria-pressed={prediction === id} disabled={busy || revealed} onClick={() => setPrediction(id)}>Pot ball {id}</Button>)}</div>
    {revealed && pair && <>
      <p role="status"><strong>{prediction === null ? 'Compare what remains after each pot.' : prediction === 1 ? 'Your prediction removes the blocker.' : 'Potting ball 3 leaves the blocker on the table.'}</strong></p>
      <p>Both reference openers legally pot their chosen ball without a scratch. Every other object ball stays in place.</p>
      <figure><figcaption><strong>Ball 3 · finish {blocked.label}: the corridor stays blocked</strong></figcaption>
        <NextPocketDiagram balls={pair.blocked.scenario.balls} route={pair.blocked.route} blockerId={1} blocked label="After potting ball 3: ball 1 still blocks the pocket line" />
        <p>The cue approach is clear, but ball 1 still blocks ball 2’s line to the {pocket} pocket.</p></figure>
      <figure><figcaption><strong>Ball 1 · finish {opened.label}: the corridor opens</strong></figcaption>
        <NextPocketDiagram balls={pair.opened.scenario.balls} route={pair.opened.route} blockerId={1} label="After potting ball 1: the next corridor is open" />
        <p>Ball 1 has actually been potted. Both corridors are clear, and the {pair.opened.route.cutAngle.toFixed(1)}° cut is within the 50° practice limit.</p></figure>
      <p>These are the actual settled layouts. Cyan marks the cue approach and contact ring; the pocket-line band is one ball diameter wide.</p>
      <p>{[contrast.openedId, contrast.blockedId].includes(result!.selected.plan.id) ? 'Your selected opener is one of these reference shots.' : 'Your selected finish is another option; these diagrams compare the two named reference shots.'}</p>
      <Button size="sm" variant="outline" aria-expanded={proof === 'actual'} onClick={() => setProof(proof === 'actual' ? null : 'actual')}>Verify the newly opened route</Button>
      {proof === 'actual' && <><p>From ball 1’s actual finish, this simulation legally pots ball 2 into the {pocket} pocket without a scratch. Every remaining ball is retained. The diagram shows the starting balls and simulated paths.</p><SequenceDiagram balls={pair.opened.proof.scenario.balls} simulation={pair.opened.proof.simulation} label="Actual next-pot proof after removing ball 1 by potting it" /></>}
      <Button size="sm" variant="outline" aria-expanded={proof === 'restored'} onClick={() => setProof(proof === 'restored' ? null : 'restored')}>Restore only ball 1</Button>
      {proof === 'restored' && <><p><strong>Diagnostic only:</strong> restore ball 1 to its original spot, keeping the actual cue finish and all other balls fixed. The same pocket line is blocked again. The opening pot’s removal made the difference.</p><NextPocketDiagram balls={pair.opened.withBlocker.balls} route={pair.opened.route} blockerId={1} blocked label="Counterfactual: restoring only ball 1 blocks the opened route" /></>}
      <Button size="sm" variant="outline" aria-expanded={proof === 'removed'} onClick={() => setProof(proof === 'removed' ? null : 'removed')}>Remove only the retained blocker</Button>
      {proof === 'removed' && <><p><strong>Diagnostic only:</strong> remove ball 1 after the ball 3 opener, keeping that cue finish and every other remaining ball fixed. The same pocket becomes available within the 50° limit and this simulation legally pots ball 2. This is not a second gameplay removal.</p><SequenceDiagram balls={pair.blocked.proof.scenario.balls} simulation={pair.blocked.proof.simulation} label="Counterfactual next-pot proof with only retained ball 1 removed" /></>}
      <p className="lesson-comparison-note">The comparison checks this named pocket, not every possible next shot. These are nominal proofs, not success-rate estimates. Regular scoring evaluates the opener; the continuation is separate practice.</p>
      <Button size="sm" variant="outline" onClick={() => { setRetry(true); setPrediction(null); setProof(null) }}>Try the prediction again</Button>
    </>}
    {revealed && !pair && <p role="status">The corridor comparison could not be verified for this result.</p>}
    {result && retry && <Button size="sm" onClick={() => setRetry(false)}>Check prediction</Button>}
    <p className="lesson-comparison-note">This prediction is optional and never blocks advancement.</p>
  </section>
}
