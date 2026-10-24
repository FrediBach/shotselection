import { useMemo, useState } from 'react'
import { Button } from './ui/button'
import SequenceDiagram from './SequenceDiagram'
import NextPocketDiagram from './NextPocketDiagram'
import { corridorCenterPairFinder } from '../engine/corridor-center'
import { nearestPoint } from '../engine/ball-width'
import { TABLE } from '../engine/constants'
import { POCKET_GEOMETRY } from '../engine/table-geometry'
import type { PreparedRound, RoundAnalysis } from '../engine/types'

export default function CorridorCenterComparison({ prepared, result, hidden, busy }: { prepared: PreparedRound; result: RoundAnalysis | null; hidden: boolean; busy: boolean }) {
  const [prediction, setPrediction] = useState<string | null>(null), [retry, setRetry] = useState(false), [proof, setProof] = useState<string | null>(null)
  const contrast = prepared.corridorCenter!
  const options = prepared.balls[0].options.filter(o => [contrast.centerId, contrast.edgeId].includes(o.id))
  const pair = useMemo(() => result ? corridorCenterPairFinder(prepared.scenario)(result.candidates.filter(s => [contrast.centerId, contrast.edgeId].includes(s.plan.id)).map(s => ({ plan: s.plan, simulation: s.nominal }))) : null, [prepared, result, contrast])
  const revealed = Boolean(result) && !retry
  return <section className="lesson-comparison" aria-label="Corridor-center comparison" hidden={hidden}>
    <h3>Leave room on both sides</h3>
    <p>Strokes {options.map(o => o.label).join(' and ')} both reach the shared zone and leave ball 2 playable. Which next cue approach passes nearer the center of the gap between balls 3 and 4?</p>
    <div className="lesson-predictions" role="group" aria-label="Corridor-center prediction">{options.map(o => <Button key={o.id} size="sm" variant={prediction === o.id ? 'default' : 'outline'} aria-pressed={prediction === o.id} disabled={busy || revealed} onClick={() => setPrediction(o.id)}>Stroke {o.label}</Button>)}</div>
    {revealed && pair && <>
      <p role="status"><strong>{prediction === null ? 'Compare the clearance on both sides.' : prediction === contrast.centerId ? 'Your prediction leaves more room on both sides.' : 'The other finish aims nearer the corridor center.'}</strong></p>
      <p>Both openers legally pot ball 1 into the same pocket and leave every remaining object ball unchanged. Both next shots use the {POCKET_GEOMETRY.find(p => p.id === pair.central.route.pocketId)!.name}, within the {prepared.scenario.objective!.maxCutAngle}° cut limit. Their cuts differ by only {Math.abs(pair.central.route.cutAngle - pair.marginal.route.cutAngle).toFixed(1)}°.</p>
      {options.map(o => {
        const central = o.id === contrast.centerId, e = central ? pair.central : pair.marginal, continuation = central ? pair.centerProof : pair.edgeProof
        const mid = { x: (e.sides[0].position.x + e.sides[1].position.x) / 2, y: (e.sides[0].position.y + e.sides[1].position.y) / 2 }
        const cue = e.opening.simulation.cueEnd, color = central ? '#7de3ef' : '#ff9f98'
        return <figure key={o.id}>
          <figcaption><strong>Stroke {o.label} · {central ? 'Corridor center' : 'Corridor edge'}</strong></figcaption>
          <NextPocketDiagram balls={continuation.scenario.balls} route={e.route} blockerId={3} label={`Stroke ${o.label}: settled finish and next pocket`} />
          <dl className="geometry-measures"><div><dt>Next cut</dt><dd>{e.route.cutAngle.toFixed(1)}°</dd></div>{e.sides.map(b => <div key={b.id}><dt>Clearance beside ball {b.id}</dt><dd>{(b.clearance * 1000).toFixed(1)} mm</dd></div>)}</dl>
          <svg viewBox={`${mid.x - .22} ${mid.y - .22} .44 .44`} role="img" aria-label={`Stroke ${o.label}: enlarged ${central ? 'center' : 'edge'} clearance`}>
            <rect width="2.54" height="1.27" fill="#143f38" />
            <line x1={cue.x} y1={cue.y} x2={e.route.ghost.x} y2={e.route.ghost.y} stroke={color} strokeWidth={TABLE.ballDiameter} strokeOpacity=".22" />
            <line x1={cue.x} y1={cue.y} x2={e.route.ghost.x} y2={e.route.ghost.y} stroke={color} strokeWidth=".003" />
            {e.sides.map(b => {
              const nearest = nearestPoint(b.position, cue, e.route.ghost)
              return <g key={b.id}><circle cx={nearest.x} cy={nearest.y} r={TABLE.ballRadius} fill="#fff" fillOpacity=".22" stroke="#fff" strokeWidth=".0015" /><circle cx={b.position.x} cy={b.position.y} r={TABLE.ballRadius} fill="#ffc16e" /><text x={b.position.x} y={b.position.y + .008} textAnchor="middle" fontSize=".026" fill="#071e1b">{b.id}</text></g>
            })}
          </svg>
          <p>Minimum surface gap: <strong>{(e.clearance * 1000).toFixed(1)} mm</strong>. The white outlines show the cue at its closest pass beside each ball, at full ball width.</p>
          <Button size="sm" variant="outline" aria-expanded={proof === o.id} onClick={() => setProof(proof === o.id ? null : o.id)}>{proof === o.id ? `Hide stroke ${o.label} next pot` : `Show stroke ${o.label} next pot`}</Button>
          {proof === o.id && <><p>Simulated continuation from this exact settled finish, with every remaining ball retained. Ball 2 is legally potted without a scratch or spare-ball contact.</p><SequenceDiagram balls={continuation.scenario.balls} simulation={continuation.simulation} label={`Stroke ${o.label}: actual next pot with both gate balls retained`} /></>}
        </figure>
      })}
      <p>The diagrams show the next shot from each actual finish. The center approach has nearly equal margins on both sides; the edge approach is still playable but has less spare room. Corridor center means between the balls, not the center of the landing zone.</p>
      <p>Your selected stroke {result!.selected.plan.id === contrast.centerId ? 'is the center reference.' : result!.selected.plan.id === contrast.edgeId ? 'is the edge reference.' : 'is the third alternative; these diagrams compare the other two strokes.'}</p>
      <p className="lesson-comparison-note">These are nominal geometric margins, not measured collision probabilities. Regular scoring still checks the opening pot, zone and next-shot access. Pace and spin differ between the offered openers.</p>
      <Button size="sm" variant="outline" onClick={() => { setRetry(true); setPrediction(null); setProof(null) }}>Try the prediction again</Button>
    </>}
    {revealed && !pair && <p role="status">The corridor comparison could not be verified for this result.</p>}
    {result && retry && <Button size="sm" onClick={() => setRetry(false)}>Check prediction</Button>}
    <p className="lesson-comparison-note">This prediction is optional and never blocks advancement.</p>
  </section>
}
