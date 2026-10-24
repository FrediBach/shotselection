import { useId, useState } from 'react'
import { Button } from './ui/button'
import { plantDeliveryEvidence } from '../engine/plant-delivery'
import { TABLE } from '../engine/constants'
import { CUSHIONS, POCKET_GEOMETRY } from '../engine/table-geometry'
import type { PreparedRound, RoundAnalysis, Vec2 } from '../engine/types'
const points = (p: Vec2[]) => p.map(v => `${v.x},${v.y}`).join(' ')
export default function PlantDeliveryComparison({ prepared, result, hidden, busy }: { prepared: PreparedRound; result: RoundAnalysis | null; hidden: boolean; busy: boolean }) {
  const [prediction, setPrediction] = useState<string | null>(null), [retry, setRetry] = useState(false)
  const marker = useId(), x = prepared.plantDelivery!, option = prepared.balls.find(b => b.ballId === 1)!.options.find(o => o.id === x.referenceId)!
  const e = plantDeliveryEvidence(prepared.scenario, option.plan, x.simulation)!, revealed = Boolean(result) && !retry
  const cue = e.first.positions[0], first = e.first.positions[1], target = e.geometry.target
  const incoming = [{ x: cue.x - e.incoming.x * .13, y: cue.y - e.incoming.y * .13 }, { x: cue.x - e.incoming.x * .035, y: cue.y - e.incoming.y * .035 }]
  const pair = [first, { x: first.x + e.geometry.direction.x * .17, y: first.y + e.geometry.direction.y * .17 }]
  const center = { x: (incoming[0].x + pair[1].x) / 2, y: (incoming[0].y + pair[1].y) / 2 }
  return <section className="lesson-comparison" aria-label="Plant delivery comparison" hidden={hidden}>
    <h3>Read the delivery and the pair</h3>
    <p>The pair points toward the pocket. Before choosing plant finish {option.label}, which checks do you need?</p>
    <div role="group" className="lesson-predictions" aria-label="Plant delivery prediction">{['Pair line alone', 'Pair line and first contact'].map(answer => <Button key={answer} size="sm" variant={prediction === answer ? 'default' : 'outline'} aria-pressed={prediction === answer} disabled={busy || revealed} onClick={() => setPrediction(answer)}>{answer}</Button>)}</div>
    {revealed && <>
      <p role="status"><strong>{prediction === 'Pair line and first contact' ? 'Correct: check the first contact as well as the pair line.' : 'Check the first contact as well as the pair line.'}</strong></p>
      <figure><figcaption><strong>First contact · Cue → ball 1 · {e.first.time.toFixed(3)} s</strong></figcaption>
        <svg viewBox={`${center.x - .21} ${center.y - .21} .42 .42`} role="img" aria-label="First-contact detail: incoming cue direction and initial pair direction">
          <defs>{[['incoming', '#fff'], ['pair', '#ffc16e']].map(([id, color]) => <marker key={id} id={`${marker}-${id}`} markerWidth="4" markerHeight="4" refX="3" refY="2" orient="auto"><path d="M0,0 L4,2 L0,4 Z" fill={color} /></marker>)}</defs>
          <rect x={center.x - .21} y={center.y - .21} width=".42" height=".42" fill="#143f38" />
          <polyline data-testid="delivery-incoming" points={points(incoming)} fill="none" stroke="#fff" strokeWidth=".004" markerEnd={`url(#${marker}-incoming)`} />
          <polyline data-testid="delivery-pair-arrow" points={points(pair)} fill="none" stroke="#ffc16e" strokeWidth=".004" strokeDasharray=".01 .006" markerEnd={`url(#${marker}-pair)`} />
          <polyline data-testid="delivery-contact-normal" points={points([cue, first])} fill="none" stroke="#7de3ef" strokeWidth=".003" />
          {([[0, cue], [1, first], [2, target]] as const).map(([id, v]) => {
            return <g key={id}><circle data-testid={`delivery-ball-${id}`} cx={v.x} cy={v.y} r={TABLE.ballRadius} fill={id === 0 ? '#fff' : id === 1 ? '#7de3ef' : '#ffc16e'} /><text x={v.x} y={v.y + .007} textAnchor="middle" fontSize={id === 0 ? '.016' : '.022'} fill="#071e1b">{id === 0 ? 'Cue' : id}</text></g>
          })}
        </svg>
      </figure>
      <ol><li><strong>Delivery to ball 1:</strong> the solid white arrow shows the cue ball’s recorded incoming direction at first contact.</li><li><strong>Pair direction:</strong> the dashed gold arrow extends the initial centers of ball 1 and ball 2 toward the pocket.</li></ol>
      <p>These directions differ by {e.deliveryAngle.toFixed(1)}°. The cue must arrive on the correct side of ball 1 to send motion through the pair. A pair aimed at the pocket does not remove this first cut.</p>
      <p>The cue and ball 1 are shown at their recorded centers immediately before collision resolution. Ball 2 is still at its starting position. The thin cyan segment joins the contacting centers; it is not the cue’s incoming direction. The geometric pair arrow is not a simulated trajectory.</p>
      <figure><figcaption><strong>Reference replay paths · Delivery and target pot</strong></figcaption>
        <svg viewBox="-.08 -.08 2.70 1.43" role="img" aria-label="Full table: cue delivery, initial pair line and actual target pot">
          <rect x="-.08" y="-.08" width="2.70" height="1.43" fill="#0b241f" /><rect width="2.54" height="1.27" fill="#143f38" />
          {CUSHIONS.map(c => <polygon key={c.id} points={points(c.polygon)} fill="#205247" stroke="#8aa99f" strokeWidth=".002" />)}
          {POCKET_GEOMETRY.map(p => <circle key={p.id} cx={p.center.x} cy={p.center.y} r={p.radius} fill="#061713" />)}
          <polyline data-testid="delivery-cue-path" points={points(x.simulation.cueApproachPath)} fill="none" stroke="#fff" strokeWidth=".008" />
          <polyline data-testid="delivery-target-path" points={points(x.simulation.objectPath)} fill="none" stroke="#7de3bf" strokeWidth=".009" />
          <polyline data-testid="delivery-pair-line" points={points([e.geometry.first, target, e.geometry.hit])} fill="none" stroke="#ffc16e" strokeWidth=".004" strokeDasharray=".012 .008" />
          <polyline points={points(e.pocket.mouth)} fill="none" stroke="#ffc16e" strokeWidth=".008" />
          {prepared.scenario.balls.map(b => <g key={b.id}><circle cx={b.position.x} cy={b.position.y} r={TABLE.ballRadius} fill={b.id === 0 ? '#fff' : b.id === 1 ? '#7de3ef' : b.id === 2 ? '#ffc16e' : '#9aa9a4'} /><text x={b.position.x} y={b.position.y + .009} textAnchor="middle" fontSize=".026" fill="#071e1b">{b.id || ''}</text></g>)}
        </svg>
      </figure>
      <p>White traces the cue to first contact. Green traces ball 2’s actual pot; dashed gold shows the initial pair line meeting the mouth center. Filled balls here mark starting positions. Ball 1 transfers motion to ball 2 at {e.transfer.time.toFixed(3)} s; its short travel and later cue travel are omitted.</p>
      <p>{result?.selected.plan.id === option.id ? `You chose reference plant finish ${option.label}.` : `You chose another stroke; these labels use plant finish ${option.label}.`} This nominal reference pots ball 2 without a scratch. Compare the regular trials with free ball 3 to judge the reliability and finish of the complete stroke.</p>
      <Button size="sm" variant="outline" onClick={() => { setRetry(true); setPrediction(null) }}>Try the prediction again</Button>
    </>}
    {result && retry && <Button size="sm" onClick={() => setRetry(false)}>Check prediction</Button>}
    <p className="lesson-comparison-note">This prediction is optional and never blocks advancement.</p>
  </section>
}
