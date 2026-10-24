import { useId, useMemo, useState } from 'react'
import { Button } from './ui/button'
import SequenceDiagram from './SequenceDiagram'
import { spareGrazePairFinder } from '../engine/spare-graze'
import { simulateShot } from '../engine/physics'
import { directNextShotRoutes, evaluateShotObjective } from '../engine/objectives'
import { normalize } from '../engine/math'
import { TABLE } from '../engine/constants'
import type { PreparedRound, RoundAnalysis } from '../engine/types'

export default function SpareGrazeComparison({ prepared, result, hidden, busy }: { prepared: PreparedRound; result: RoundAnalysis | null; hidden: boolean; busy: boolean }) {
  const [prediction, setPrediction] = useState<string | null>(null), [retry, setRetry] = useState(false), [removed, setRemoved] = useState(false)
  const arrowId = useId()
  const contrast = prepared.spareGraze!
  const options = prepared.balls[0].options.filter(o => [contrast.grazedId, contrast.clearId].includes(o.id))
  const pair = useMemo(() => result ? spareGrazePairFinder(prepared.scenario)(prepared.balls[0].options
    .filter(o => [contrast.grazedId, contrast.clearId].includes(o.id))
    .map(o => ({ plan: o.plan, simulation: result.candidates.find(s => s.plan.id === o.id)?.nominal ?? simulateShot(prepared.scenario, o.plan) }))) : null, [prepared, result, contrast])
  const revealed = Boolean(result) && !retry
  const contact = pair?.graze.contact, incoming = contact ? normalize(contact.incoming) : null, outgoing = contact ? normalize(contact.outgoing) : null
  return <section className="lesson-comparison" aria-label="Spare-ball graze comparison" hidden={hidden}>
    <h3>Clear pass or glancing contact?</h3>
    <p>Strokes {options.map(o => o.label).join(' and ')} both pot ball 1 into the same pocket. Which stroke then grazes ball 3 and redirects the cue ball?</p>
    <div className="lesson-predictions" role="group" aria-label="Graze prediction">{options.map(option => <Button key={option.id} size="sm" variant={prediction === option.id ? 'default' : 'outline'} aria-pressed={prediction === option.id} disabled={busy || revealed} onClick={() => setPrediction(option.id)}>Stroke {option.label}</Button>)}</div>
    {revealed && pair && <>
      <p role="status"><strong>{prediction === null ? 'Compare the contact and the clear pass.' : prediction === contrast.grazedId ? 'Your prediction identifies the graze.' : 'The other stroke grazes ball 3.'}</strong></p>
      <p>Your selected stroke {result!.selected.plan.id === contrast.grazedId ? 'grazes ball 3 after potting ball 1.' : result!.selected.plan.id === contrast.clearId ? 'passes ball 3 without contact.' : 'is the third alternative; these diagrams compare the other two strokes.'}</p>
      {options.map(option => {
        const grazed = option.id === contrast.grazedId, simulation = grazed ? pair.graze.traced : pair.clean.traced
        const objective = evaluateShotObjective(prepared.scenario, option.plan, simulation)
        return <figure key={option.id} className="graze-branch">
          <figcaption><strong>Stroke {option.label} · {grazed ? 'Graze' : 'Clear pass'}</strong></figcaption>
          <SequenceDiagram balls={prepared.scenario.balls} simulation={simulation} label={`Stroke ${option.label}: ${grazed ? 'grazed' : 'clear'} cue path from the starting layout`} />
          <dl className="geometry-measures">
            <div><dt>Legal opening pot</dt><dd>{objective.legalPot ? 'Yes' : 'No'}</dd></div>
            <div><dt>Inside the landing zone</dt><dd>{objective.positioned ? 'Yes' : 'No'}</dd></div>
            <div><dt>Permitted next routes</dt><dd>{directNextShotRoutes(prepared.scenario, simulation).length}</dd></div>
            <div><dt>Cue contact with ball 3</dt><dd>{grazed ? 'Yes, after ball 1 drops' : 'No'}</dd></div>
            <div><dt>{grazed ? 'Heading change at ball 3' : 'Minimum surface clearance from ball 3'}</dt><dd>{grazed ? `${pair.graze.deflection.toFixed(1)}°` : `${(pair.clean.clearance * 1000).toFixed(1)} mm`}</dd></div>
          </dl>
        </figure>
      })}
      <h4>At the glancing contact</h4>
      <svg viewBox={`${contact!.position.x - .15} ${contact!.position.y - .15} .3 .3`} role="img" aria-label="Enlarged cue heading before and after the graze">
        <defs><marker id={arrowId} markerWidth="4" markerHeight="4" refX="3" refY="2" orient="auto"><path d="M0,0 L4,2 L0,4 Z" fill="#ff9f98" /></marker></defs>
        <rect x="0" y="0" width={TABLE.length} height={TABLE.width} fill="#143f38" />
        <circle cx={contact!.position.x} cy={contact!.position.y} r={TABLE.ballRadius} fill="#fff" fillOpacity=".4" stroke="#fff" strokeWidth=".002" />
        <circle cx={contact!.otherPosition.x} cy={contact!.otherPosition.y} r={TABLE.ballRadius} fill="#ffc16e" />
        <text x={contact!.otherPosition.x} y={contact!.otherPosition.y + .006} textAnchor="middle" fontSize=".018" fill="#071e1b">3</text>
        <line x1={contact!.position.x - incoming!.x * .11} y1={contact!.position.y - incoming!.y * .11} x2={contact!.position.x} y2={contact!.position.y} stroke="#7de3ef" strokeWidth=".004" />
        <line x1={contact!.position.x} y1={contact!.position.y} x2={contact!.position.x + outgoing!.x * .11} y2={contact!.position.y + outgoing!.y * .11} stroke="#ff9f98" strokeWidth=".004" markerEnd={`url(#${arrowId})`} />
      </svg>
      <p>Cyan shows the incoming heading; the pink arrow shows the outgoing heading. The cue turns {pair.graze.deflection.toFixed(1)}° across the collision solver step, measured before any cushion response. These equal-scale direction lines are not traveled paths or speed arrows.</p>
      <Button size="sm" variant="outline" aria-expanded={removed} onClick={() => setRemoved(value => !value)}>{removed ? 'Hide the removal comparison' : 'Compare without ball 3'}</Button>
      {removed && <>
        <p><strong>Counterfactual: remove only ball 3 and repeat stroke {options.find(o => o.id === contrast.grazedId)!.label}.</strong> Keep the cue, balls 1, 2 and 4 and all stroke controls fixed. Ball 1 is still legally potted without a scratch. The cue finishes {(pair.graze.finishShift * 100).toFixed(1)} cm from its actual grazed finish.</p>
        <SequenceDiagram balls={pair.graze.without.balls} simulation={pair.graze.counterfactual} label="Same stroke with only ball 3 removed" />
      </>}
      <p>The offered strokes differ in pace and spin. Only the removal comparison holds the stroke fixed to isolate the collision. Balls 2 and 4 remain unmoved in both actual openings.</p>
      <p className="lesson-comparison-note">The regular score checks the opening pot, landing zone and next-shot access. This nominal comparison demonstrates deflection; it does not measure collision risk under aim errors.</p>
      <Button size="sm" variant="outline" onClick={() => { setRetry(true); setPrediction(null); setRemoved(false) }}>Try the prediction again</Button>
    </>}
    {revealed && !pair && <p role="status">The graze comparison could not be verified for this result.</p>}
    {result && retry && <Button size="sm" onClick={() => setRetry(false)}>Check prediction</Button>}
    <p className="lesson-comparison-note">This prediction is optional and never blocks advancement.</p>
  </section>
}
