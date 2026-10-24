import NextPocketDiagram from './NextPocketDiagram'
import { useMemo, useState } from 'react'
import { Button } from './ui/button'
import SequenceDiagram from './SequenceDiagram'
import { pocketChangePairFinder } from '../engine/pocket-change'
import { POCKET_GEOMETRY } from '../engine/table-geometry'
import type { PreparedRound, RoundAnalysis } from '../engine/types'


export default function PocketChangeComparison({ prepared, result, hidden, busy }: { prepared: PreparedRound; result: RoundAnalysis | null; hidden: boolean; busy: boolean }) {
  const [prediction, setPrediction] = useState<string | null>(null), [retry, setRetry] = useState(false)
  const [proof, setProof] = useState<'preferred' | 'alternate' | null>(null)
  const contrast = prepared.pocketChange!
  const options = prepared.balls[0].options.filter(o => [contrast.originalId, contrast.adaptedId].includes(o.id))
  const originalLabel = options.find(o => o.id === contrast.originalId)!.label, adaptedLabel = options.find(o => o.id === contrast.adaptedId)!.label
  const preferredName = POCKET_GEOMETRY.find(p => p.id === contrast.preferredPocketId)!.name, alternateName = POCKET_GEOMETRY.find(p => p.id === contrast.alternatePocketId)!.name
  const pair = useMemo(() => result ? pocketChangePairFinder(prepared.scenario)(result.candidates.filter(s => [contrast.originalId, contrast.adaptedId].includes(s.plan.id)).map(s => ({ plan: s.plan, simulation: s.nominal }))) : null, [prepared, result, contrast])
  const revealed = Boolean(result) && !retry
  return <section className="lesson-comparison" aria-label="Change-of-pocket comparison" hidden={hidden}>
    <h3>Change the pocket—and the finish</h3>
    <p>The lesson’s original plan is ball 2 to the {preferredName} pocket, but ball {contrast.blockerId} blocks that pocket line. Consider the {alternateName} pocket instead. Which opening finish makes that alternative usable?</p>
    <div className="lesson-predictions" role="group" aria-label="Alternative-pocket finish prediction">{options.map(option => <Button key={option.id} size="sm" variant={prediction === option.id ? 'default' : 'outline'} aria-pressed={prediction === option.id} disabled={busy || revealed} onClick={() => setPrediction(option.id)}>Stroke {option.label}</Button>)}</div>
    {revealed && pair && <>
      <p role="status"><strong>{prediction === null ? 'Compare the pocket and finish together.' : prediction === contrast.adaptedId ? 'Your prediction adapts the finish to the new pocket.' : 'Changing pockets also needs the other finish.'}</strong></p>
      <p>Both strokes pot ball 1 into the same pocket and finish inside the same zone. Balls 2, 3 and 4 remain unmoved.</p>
      <figure className="pocket-change-case">
        <figcaption><strong>Stroke {originalLabel}: original plan → {preferredName}</strong></figcaption>
        <NextPocketDiagram balls={pair.old.scenario.balls} route={pair.preferred} blockerId={contrast.blockerId} blocked label="Original finish: preferred pocket blocked by traffic" />
        <p>Ball {contrast.blockerId} blocks the object-to-pocket line. The cue approach is clear and the {pair.preferred.cutAngle.toFixed(1)}° cut is within the {prepared.scenario.objective!.maxCutAngle}° limit. Moving the cue alone cannot open this fixed pocket line.</p>
      </figure>
      <figure className="pocket-change-case">
        <figcaption><strong>Same stroke {originalLabel} finish → {alternateName}</strong></figcaption>
        <NextPocketDiagram balls={pair.old.scenario.balls} route={pair.oldAlternate} blockerId={contrast.blockerId} cutTooLarge label="Original finish: alternative pocket exceeds the cut limit" />
        <p>Both corridors are clear, but the {pair.oldAlternate.cutAngle.toFixed(1)}° cut exceeds the same {prepared.scenario.objective!.maxCutAngle}° limit. Switching the pocket alone does not solve this finish.</p>
      </figure>
      <figure className="pocket-change-case">
        <figcaption><strong>Adapt with stroke {adaptedLabel} → {alternateName}</strong></figcaption>
        <NextPocketDiagram balls={pair.next.scenario.balls} route={pair.alternate} blockerId={contrast.blockerId} label="Adapted finish: alternative pocket is available" />
        <p>The different cue finish leaves clear corridors and a {pair.alternate.cutAngle.toFixed(1)}° cut within the limit. This route has a simulated legal pot on ball 2 without a scratch.</p>
      </figure>
      <p>Cyan shows the cue approach to the contact ring. The pocket-line band is one ball diameter wide; red marks the blocked preferred line. Each diagram uses the actual settled cue and remaining balls.</p>
      <p>Your selected stroke {result!.selected.plan.id === contrast.adaptedId ? 'creates the usable alternative-pocket route.' : result!.selected.plan.id === contrast.originalId ? 'leaves the original finish with no permitted next route.' : 'is the third alternative; these diagrams compare the other two finishes.'}</p>
      <Button size="sm" variant="outline" aria-expanded={proof === 'preferred'} onClick={() => setProof(proof === 'preferred' ? null : 'preferred')}>Check preferred pocket without ball {contrast.blockerId}</Button>
      {proof === 'preferred' && <>
        <p><strong>Counterfactual: remove only ball {contrast.blockerId}.</strong> Keep stroke {originalLabel}’s settled cue and every other remaining ball fixed. The preferred {preferredName} route returns under the unchanged cut limit, and this simulation legally pots ball 2 without a scratch. This diagnostic removal is not a gameplay option.</p>
        <SequenceDiagram balls={pair.preferredProof.scenario.balls} simulation={pair.preferredProof.simulation} label="Preferred-pocket proof with only the blocker removed" />
      </>}
      <Button size="sm" variant="outline" aria-expanded={proof === 'alternate'} onClick={() => setProof(proof === 'alternate' ? null : 'alternate')}>Inspect the alternative-pocket pot</Button>
      {proof === 'alternate' && <><p>Keep every remaining ball. From stroke {adaptedLabel}’s actual finish, ball 2 goes to the {alternateName} pocket.</p><SequenceDiagram balls={pair.alternateProof.scenario.balls} simulation={pair.alternateProof.simulation} label="Alternative-pocket proof with all remaining balls" /></>}
      <p className="lesson-comparison-note">The original pocket is set for this lesson. The prediction does not nominate a scoring target: regular scoring accepts any permitted next pocket. These are nominal examples, not success-rate estimates.</p>
      <Button size="sm" variant="outline" onClick={() => { setRetry(true); setPrediction(null); setProof(null) }}>Try the prediction again</Button>
    </>}
    {revealed && !pair && <p role="status">The pocket-change comparison could not be verified for this result.</p>}
    {result && retry && <Button size="sm" onClick={() => setRetry(false)}>Check prediction</Button>}
    <p className="lesson-comparison-note">This prediction is optional and never blocks advancement.</p>
  </section>
}
