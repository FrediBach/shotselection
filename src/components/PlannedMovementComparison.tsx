import { useMemo, useState } from 'react'
import { Button } from './ui/button'
import SequenceDiagram from './SequenceDiagram'
import { plannedMovementEvidence } from '../engine/planned-movement'
import { distance } from '../engine/math'
import type { PreparedRound, RoundAnalysis } from '../engine/types'

export default function PlannedMovementComparison({ prepared, result, hidden, busy }: { prepared: PreparedRound; result: RoundAnalysis | null; hidden: boolean; busy: boolean }) {
  const [prediction, setPrediction] = useState<string | null>(null), [retry, setRetry] = useState(false)
  const [view, setView] = useState('Settled layout')
  const source = prepared.scenario, objective = source.objective!, blockerId = source.plannedMovement!.blockerId
  const evidence = useMemo(() => result?.candidates.map(s => plannedMovementEvidence(source, { plan: s.plan, simulation: s.nominal })).find(e => e !== null) ?? null, [source, result])
  const revealed = Boolean(result) && !retry
  const options = prepared.balls[0].options
  const label = evidence ? options.find(o => o.id === evidence.opening.plan.id)!.label : ''
  const old = source.balls.find(b => b.id === blockerId)!, moved = evidence?.scenario.balls.find(b => b.id === blockerId)
  const restored = view === 'Restore blocker'
  return <section className="lesson-comparison plant-quality-comparison" aria-label="Planned blocker movement" hidden={hidden}>
    <h3>Make the collision earn its place</h3>
    <p>Pot ball 1, then contact ball {blockerId} with the cue and move it at least 3 cm without potting it. Finish in the zone with a direct shot on ball 2 within {objective.maxCutAngle}°. That route must be unavailable if only the blocker is restored to its starting position.</p>
    <p>Earlier, level 46 warned against an accidental helping nudge. Here the secondary contact has an explicit purpose. After the successful planned opening, would restoring the blocker leave a permitted next shot?</p>
    <div className="lesson-predictions" role="group" aria-label="Blocker restoration prediction">{['Still available', 'Blocked'].map(answer => <Button key={answer} size="sm" variant={prediction === answer ? 'default' : 'outline'} aria-pressed={prediction === answer} disabled={busy || revealed} onClick={() => setPrediction(answer)}>{answer}</Button>)}</div>
    {revealed && evidence && <>
      <p role="status">{prediction === 'Blocked' ? 'Your prediction matches. ' : ''}Restoring ball {blockerId} blocks the next shot. Stroke {label} demonstrates the planned opening and a verified continuation.</p>
      <table><caption>Actual scoring trials</caption><thead><tr><th>Requirement</th>{options.map(o => <th key={o.id}>Stroke {o.label}</th>)}</tr></thead><tbody>{['Ordered secondary contact', 'Blocker moved and route opened', 'Complete successes'].map((name, row) => <tr key={name} data-testid={`movement-row-${row}`}><th>{name}</th>{options.map(o => {
        const shot = result!.candidates.find(s => s.plan.id === o.id)!
        const count = row === 2 ? shot.trialSuccesses!.filter(Boolean).length : shot.movementTrials!.filter(t => row === 0 ? t.contact : t.opened).length
        return <td key={o.id}>{count}/{shot.samples}</td>
      })}</tr>)}</tbody></table>
      <p>All rows use all {result!.samples} scoring trials, including misses and scratches. Contact alone is not success. The second row requires a settled, non-scratch leave and the blocker test; the last also requires the legal opening pot and zone. Trials check next-shot geometry, not a played second pot.</p>
      <div className="lesson-predictions" role="group" aria-label="Movement evidence views">{['Opening stroke', 'Settled layout', 'Next pot', 'Restore blocker'].map(name => <Button key={name} size="sm" variant={view === name ? 'default' : 'outline'} aria-pressed={view === name} onClick={() => setView(name)}>{name}</Button>)}</div>
      <p>Stroke {label} moves ball {blockerId} {(distance(old.position, moved!.position) * 100).toFixed(1)} cm. {restored ? `Restore only ball ${blockerId}; keep the cue and every other ball at their actual settled positions. The identical next stroke hits the blocker first and fails.` : view === 'Next pot' ? `The simulated next pot uses a ${evidence.route.cutAngle.toFixed(1)}° cut, correct first contact and no scratch.` : view === 'Opening stroke' ? 'Starting balls and actual opening paths are shown; the white ring marks the cue finish.' : 'These are the actual settled balls after the opening. The blocker remains on the table.'}</p>
      <SequenceDiagram balls={view === 'Opening stroke' ? source.balls : restored ? evidence.restored.balls : evidence.scenario.balls} simulation={view === 'Opening stroke' ? evidence.opening.simulation : view === 'Next pot' ? evidence.simulation : restored ? evidence.blocked : undefined} zone={{ target: objective.target!, radius: objective.radius }} label="Planned movement evidence" />
      <p className="lesson-comparison-note">The next-pot and restoration diagrams use the same aim, pace and spin. They prove the blocker’s role for this nominal example. The sampled rates come from the original scoring simulations; they are not a guarantee that every opened route will be potted.</p>
      <Button size="sm" variant="outline" onClick={() => { setRetry(true); setPrediction(null); setView('Settled layout') }}>Try the prediction again</Button>
    </>}
    {revealed && !evidence && <p role="status">No planned-movement proof is available for this layout.</p>}
    {result && retry && <Button size="sm" onClick={() => setRetry(false)}>Check prediction</Button>}
    <p className="lesson-comparison-note">Prediction is optional. Scoring and tolerance require the planned contact and newly opened route as well as the pot and zone.</p>
  </section>
}
