import { useMemo, useState } from 'react'
import { Button } from './ui/button'
import SequenceDiagram from './SequenceDiagram'
import { fallbackPairFinder } from '../engine/fallback-plan'
import { simulateShot } from '../engine/physics'
import type { PreparedRound, RoundAnalysis } from '../engine/types'

export default function FallbackPlanComparison({ prepared, result, hidden, busy }: { prepared: PreparedRound; result: RoundAnalysis | null; hidden: boolean; busy: boolean }) {
  const [prediction, setPrediction] = useState<string | null>(null), [retry, setRetry] = useState(false)
  const [proof, setProof] = useState<string | null>(null)
  const contrast = prepared.fallbackPlan!
  const options = prepared.balls[0].options.filter(o => [contrast.narrowId, contrast.flexibleId].includes(o.id))
  const pair = useMemo(() => fallbackPairFinder(prepared.scenario)(prepared.balls[0].options
    .filter(o => [contrast.narrowId, contrast.flexibleId].includes(o.id))
    .map(o => ({ plan: o.plan, simulation: result?.candidates.find(s => s.plan.id === o.id)!.nominal ?? simulateShot(prepared.scenario, o.plan) }))), [prepared, result, contrast])
  const revealed = Boolean(result) && !retry
  return <section className="lesson-comparison" aria-label="Fallback-plan comparison" hidden={hidden}>
    <h3>Which finish keeps a fallback?</h3>
    <p>Strokes {options.map(o => o.label).join(' and ')} pot ball 1 into the same pocket and stop inside the same zone. Which finish leaves two playable next balls instead of one narrow continuation?</p>
    <div className="lesson-predictions" role="group" aria-label="Fallback prediction">{options.map(option => <Button key={option.id} size="sm" variant={prediction === option.id ? 'default' : 'outline'} aria-pressed={prediction === option.id} disabled={busy || revealed} onClick={() => setPrediction(option.id)}>Stroke {option.label}</Button>)}</div>
    {pair && options.map(option => {
      const evidence = option.id === contrast.narrowId ? pair.single : pair.multiple
      return <figure key={option.id} className="fallback-branch">
        <figcaption><strong>Stroke {option.label}{revealed ? ` · ${evidence.available.length} playable next ${evidence.available.length === 1 ? 'ball' : 'balls'}` : ' · settled finish'}</strong></figcaption>
        <SequenceDiagram balls={evidence.scenario.balls} label={`Stroke ${option.label}: actual settled layout`} />
        {revealed && <>
          <dl className="geometry-measures">{evidence.choices.map(choice => <div key={choice.ballId}><dt>Ball {choice.ballId}: permitted pocket routes</dt><dd>{choice.routes.length}</dd></div>)}</dl>
          {option.id === contrast.narrowId && <p>The only route is ball 2 at a {pair.single.available[0].routes[0].cutAngle.toFixed(1)}° cut, close to this lesson’s {prepared.scenario.objective!.maxCutAngle}° limit. “Narrow” describes that cut margin, not a measured success rate.</p>}
          {evidence.proofs.map(witness => {
            const key = `${option.id}-${witness.ballId}`
            return <div key={key}>
              <Button size="sm" variant="outline" aria-expanded={proof === key} onClick={() => setProof(proof === key ? null : key)}>Inspect stroke {option.label} → ball {witness.ballId}</Button>
              {proof === key && <><p>Verified nominal pot on ball {witness.ballId}, no scratch. This shot starts from stroke {option.label}’s settled finish.</p><SequenceDiagram balls={evidence.scenario.balls} simulation={witness.simulation} label={`Stroke ${option.label}: simulated next pot on ball ${witness.ballId}`} /></>}
            </div>
          })}
        </>}
      </figure>
    })}
    {revealed && pair && <>
      <p role="status"><strong>{prediction === null ? 'Compare the available next balls.' : prediction === contrast.flexibleId ? 'Your prediction preserves a fallback.' : 'That finish leaves only one narrow continuation.'}</strong> Stroke {options.find(o => o.id === contrast.flexibleId)!.label} keeps balls {pair.multiple.available.map(c => c.ballId).join(' and ')} playable.</p>
      <p>Your selected stroke {result!.selected.plan.id === contrast.flexibleId ? 'preserves the two next-ball choices.' : result!.selected.plan.id === contrast.narrowId ? 'leaves the single narrow route.' : 'is the third alternative; these diagrams compare the other two finishes.'}</p>
      <p>Each count checks all remaining balls, both shot corridors and the same cut limit. Every playable ball also has a simulated legal pot. The two fallback shots are alternatives from the same finish, not a sequence that pots both balls.</p>
      <p className="lesson-comparison-note">Opening scoring still checks ball 1, the zone and access to ball 2. The fallback comparison is separate nominal evidence; it does not measure tolerance to errors or a combined completion rate.</p>
      <Button size="sm" variant="outline" onClick={() => { setRetry(true); setPrediction(null); setProof(null) }}>Try the prediction again</Button>
    </>}
    {!pair && <p role="status">The fallback comparison could not be verified for this layout.</p>}
    {result && retry && <Button size="sm" onClick={() => setRetry(false)}>Check prediction</Button>}
    <p className="lesson-comparison-note">This prediction is optional and never blocks advancement.</p>
  </section>
}
