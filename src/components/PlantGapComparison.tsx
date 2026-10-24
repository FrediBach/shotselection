import { useState } from 'react'
import { Button } from './ui/button'
import { plantGapEvidence } from '../engine/plant-gap'
import { TABLE } from '../engine/constants'
import { CUSHIONS, POCKET_GEOMETRY } from '../engine/table-geometry'
import type { PreparedRound, RoundAnalysis, Vec2 } from '../engine/types'
const points = (p: Vec2[]) => p.map(v => `${v.x},${v.y}`).join(' ')
export default function PlantGapComparison({ prepared, result, hidden, busy }: { prepared: PreparedRound; result: RoundAnalysis | null; hidden: boolean; busy: boolean }) {
  const [prediction, setPrediction] = useState<string | null>(null), [retry, setRetry] = useState(false), [transferred, setTransferred] = useState(false)
  const x = prepared.plantGap!, option = prepared.balls.find(b => b.ballId === 1)!.options.find(o => o.id === x.referenceId)!
  const e = plantGapEvidence(prepared.scenario, option.plan, x.simulation)!, revealed = Boolean(result) && !retry
  const first = transferred ? e.transfer.positions[0] : e.first.positions[1], target = e.targetBall.position
  const center = { x: (e.firstBall.position.x + target.x) / 2, y: (e.firstBall.position.y + target.y) / 2 }
  return <section className="lesson-comparison" aria-label="Plant transfer-gap comparison" hidden={hidden}>
    <h3>Follow ball 1 across the gap</h3>
    <p>After the cue strikes ball 1, which travel must you include before choosing the plant?</p>
    <div role="group" className="lesson-predictions" aria-label="Transfer-gap prediction">{['Only ball 2’s potting run', 'Ball 1’s gap and ball 2’s run'].map(answer => <Button key={answer} size="sm" variant={prediction === answer ? 'default' : 'outline'} aria-pressed={prediction === answer} disabled={busy || revealed} onClick={() => setPrediction(answer)}>{answer}</Button>)}</div>
    {revealed && <>
      <p role="status"><strong>{prediction === 'Ball 1’s gap and ball 2’s run' ? 'Correct: ball 1 must first cross the gap and contact ball 2.' : 'Ball 1 must first cross the gap and contact ball 2.'}</strong></p>
      <p>The centers start {(e.spacing * 100).toFixed(1)} cm apart. With {(TABLE.ballDiameter * 100).toFixed(2)} cm diameter balls, the empty surface-to-surface gap is {(e.gap * 100).toFixed(2)} cm. Center spacing is not the distance ball 1 must travel before contact.</p>
      <div role="group" className="lesson-predictions" aria-label="Inspect gap travel"><Button size="sm" variant={!transferred ? 'default' : 'outline'} aria-pressed={!transferred} onClick={() => setTransferred(false)}>Cue → 1</Button><Button size="sm" variant={transferred ? 'default' : 'outline'} aria-pressed={transferred} onClick={() => setTransferred(true)}>1 → 2</Button></div>
      <figure><figcaption><strong>{transferred ? 'At transfer to ball 2' : 'At first cue contact'} · {(transferred ? e.transfer.time : e.first.time).toFixed(3)} s</strong></figcaption>
        <svg viewBox={`${center.x - .16} ${center.y - .16} .32 .32`} role="img" aria-label="Ball 1 gap travel between recorded contact positions">
          <rect x={center.x - .16} y={center.y - .16} width=".32" height=".32" fill="#143f38" />
          {transferred && <>
            <circle cx={e.firstBall.position.x} cy={e.firstBall.position.y} r={TABLE.ballRadius} fill="none" stroke="#7de3ef" strokeWidth=".002" strokeDasharray=".006 .004" />
            <polyline data-testid="gap-detail-path" points={points(e.path)} fill="none" stroke="#7de3ef" strokeWidth=".004" />
          </>}
          {([[1, first], [2, target]] as const).map(([id, v]) => <g key={id}><circle data-testid={`gap-contact-ball-${id}`} cx={v.x} cy={v.y} r={TABLE.ballRadius} fill={id === 1 ? '#7de3ef' : '#ffc16e'} /><text x={v.x} y={v.y + .007} textAnchor="middle" fontSize=".023" fill="#071e1b">{id}</text></g>)}
        </svg>
      </figure>
      <p>{transferred ? 'Cyan traces ball 1’s recorded centers at each solver step up to the instant of transfer. The dashed circle marks its starting position.' : 'These are the ball centers when the cue first contacts ball 1. Switch to 1 → 2 to reveal the actual travel across the gap.'} Ball 2 stays stationary until the transfer.</p>
      <p>In reference finish {option.label}, ball 1 travels {(e.travel * 100).toFixed(2)} cm over {(e.duration * 1000).toFixed(1)} ms between the two recorded contacts. This is the sampled path length, not an invented line joining endpoints. The trace ends immediately before the 1→2 collision is resolved; ball 1’s later travel is omitted.</p>
      <figure><figcaption><strong>Three parts of the reference plant</strong></figcaption>
        <svg viewBox="-.08 -.08 2.70 1.43" role="img" aria-label="Full plant: cue approach, ball 1 transfer travel and ball 2 potting path">
          <rect x="-.08" y="-.08" width="2.70" height="1.43" fill="#0b241f" /><rect width="2.54" height="1.27" fill="#143f38" />
          {CUSHIONS.map(c => <polygon key={c.id} points={points(c.polygon)} fill="#205247" stroke="#8aa99f" strokeWidth=".002" />)}
          {POCKET_GEOMETRY.map(p => <circle key={p.id} cx={p.center.x} cy={p.center.y} r={p.radius} fill="#061713" />)}
          <polyline data-testid="gap-cue-path" points={points(x.simulation.cueApproachPath)} fill="none" stroke="#fff" strokeWidth=".007" />
          <polyline data-testid="gap-transfer-path" points={points(e.path)} fill="none" stroke="#7de3ef" strokeWidth=".009" />
          <polyline data-testid="gap-target-path" points={points(x.simulation.objectPath)} fill="none" stroke="#ffc16e" strokeWidth=".007" />
          {prepared.scenario.balls.map(b => <g key={b.id}><circle cx={b.position.x} cy={b.position.y} r={TABLE.ballRadius} fill={b.id === 0 ? '#fff' : b.id === 1 ? '#7de3ef' : b.id === 2 ? '#ffc16e' : '#9aa9a4'} /><text x={b.position.x} y={b.position.y + .009} textAnchor="middle" fontSize=".026" fill="#071e1b">{b.id || ''}</text></g>)}
        </svg>
      </figure>
      <ol><li>White: cue approach to ball 1 at {e.first.time.toFixed(3)} s.</li><li>Cyan: ball 1 crosses the gap to ball 2 at {e.transfer.time.toFixed(3)} s.</li><li>Gold: ball 2’s actual potting travel.</li></ol>
      <p>Filled balls in the full-table view mark starting positions. The reference completes both contacts and pots ball 2, but this one success does not establish reliability. A contact error can change how ball 1 reaches ball 2 before the final potting run even begins.</p>
      <p>{result?.selected.plan.id === option.id ? `You chose reference plant finish ${option.label}.` : `You chose another stroke; this trace uses plant finish ${option.label}.`} The other plant attempts remain selectable, including nominal misses. Compare all plant/free-ball trials and cue-ball finishes when deciding which complete stroke to trust.</p>
      <Button size="sm" variant="outline" onClick={() => { setRetry(true); setPrediction(null); setTransferred(false) }}>Try the prediction again</Button>
    </>}
    {result && retry && <Button size="sm" onClick={() => setRetry(false)}>Check prediction</Button>}
    <p className="lesson-comparison-note">This prediction is optional and never blocks advancement.</p>
  </section>
}
