import { useState } from 'react'
import { Button } from './ui/button'
import { plantLineEvidence } from '../engine/plant-line'
import { TABLE } from '../engine/constants'
import { CUSHIONS, POCKET_GEOMETRY } from '../engine/table-geometry'
import type { PreparedRound, RoundAnalysis, Vec2 } from '../engine/types'
const points = (p: Vec2[]) => p.map(v => `${v.x},${v.y}`).join(' ')
export default function PlantLineComparison({ prepared, result, hidden, busy }: { prepared: PreparedRound; result: RoundAnalysis | null; hidden: boolean; busy: boolean }) {
  const [prediction, setPrediction] = useState<string | null>(null), [retry, setRetry] = useState(false)
  const x = prepared.plantLine!, option = prepared.balls.find(b => b.ballId === 1)!.options.find(o => o.id === x.referenceId)!
  const e = plantLineEvidence(prepared.scenario, option.plan, x.simulation)!, revealed = Boolean(result) && !retry
  const center = { x: (e.first.x + e.pocket.mouthCenter.x) / 2, y: (e.first.y + e.pocket.mouthCenter.y) / 2 }
  const drawing = (id: string) => <>
    <rect x="-.2" y="-.2" width="2.94" height="1.67" fill="#0b241f" />
    <rect width="2.54" height="1.27" fill="#143f38" />
    {CUSHIONS.map(c => <polygon key={c.id} points={points(c.polygon)} fill="#205247" stroke="#8aa99f" strokeWidth=".002" />)}
    {POCKET_GEOMETRY.map(p => <circle key={p.id} cx={p.center.x} cy={p.center.y} r={p.radius} fill="#061713" />)}
    <polyline data-testid={`${id}-actual`} points={points(x.simulation.objectPath)} fill="none" stroke="#ff9f98" strokeWidth=".005" />
    <polyline data-testid={`${id}-line`} points={points([e.first, e.target, e.hit])} fill="none" stroke="#fff" strokeWidth=".003" strokeDasharray=".012 .008" />
    <polyline data-testid={`${id}-mouth`} points={points(e.pocket.mouth)} fill="none" stroke="#ffc16e" strokeWidth=".006" />
    {e.pocket.mouth.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r=".005" fill="#ffc16e" />)}
    <polyline data-testid={`${id}-outside`} points={points([e.edge, e.hit])} fill="none" stroke="#ff9f98" strokeWidth=".006" />
    {prepared.scenario.balls.map(b => <g key={b.id}><circle cx={b.position.x} cy={b.position.y} r={TABLE.ballRadius} fill={b.id === 0 ? '#fff' : b.id === 1 ? '#7de3ef' : b.id === 2 ? '#ffc16e' : '#9aa9a4'} /><text x={b.position.x} y={b.position.y + .009} textAnchor="middle" fontSize=".026" fill="#071e1b">{b.id || ''}</text></g>)}
    <g data-testid={`${id}-hit`} transform={`translate(${e.hit.x} ${e.hit.y})`}><path d="M-.007,-.007 L.007,.007 M-.007,.007 L.007,-.007" stroke="#fff" strokeWidth=".003" /></g>
  </>
  return <section className="lesson-comparison" aria-label="Plant pair-line comparison" hidden={hidden}>
    <h3>Does the pair point into the opening?</h3>
    <p>Extend the initial line from ball 1’s center through ball 2’s center to the pocket-mouth line. Does it cross inside the opening or outside it?</p>
    <p>Use plant finish {option.label} as the physical reference. The plant attempts and direct shot on free ball 3 remain your scored choices.</p>
    <div role="group" className="lesson-predictions" aria-label="Pair-line prediction">{['Inside opening', 'Outside opening'].map(answer => <Button key={answer} size="sm" variant={prediction === answer ? 'default' : 'outline'} aria-pressed={prediction === answer} disabled={busy || revealed} onClick={() => setPrediction(answer)}>{answer}</Button>)}</div>
    {revealed && <>
      <p role="status"><strong>{prediction === null ? 'The pair line crosses outside the opening.' : prediction === 'Outside opening' ? 'Correct: the pair line crosses outside the opening.' : 'The balls are close, but their line crosses outside the opening.'}</strong></p>
      <figure><figcaption><strong>Pair line at the pocket mouth</strong></figcaption>
        <svg viewBox={`${center.x - .25} ${center.y - .25} .50 .50`} role="img" aria-label="Pocket-mouth detail: geometric crossing outside the opening and actual ball 2 path">{drawing('pair-detail')}</svg>
      </figure>
      <p>The gold segment is the {(e.width * 1000).toFixed(1)} mm opening between the cushion noses. The white cross marks the initial pair line’s intersection with the extended mouth line: {(e.outside * 1000).toFixed(1)} mm beyond its nearest edge. Even the projected center misses the opening; this is not a ball-width clearance or an acceptance margin.</p>
      <p>White dashes are the initial center-line projection, not a simulated trajectory. Pink is ball 2’s actual recorded travel. Contact delivery, throw and cushion/jaw collisions can make it differ from the initial pair line; the projection alone does not simulate those effects.</p>
      <figure><figcaption><strong>Reference plant · Actual target-ball miss</strong></figcaption>
        <svg viewBox="-.08 -.08 2.70 1.43" role="img" aria-label="Full table: initial pair line and simulated target-ball miss">{drawing('pair-table')}</svg>
      </figure>
      <p>This stroke contacts ball 1 first at {e.firstContact.time.toFixed(3)} s, then ball 1 contacts ball 2 at {e.transfer.time.toFixed(3)} s. Ball 2 reaches the pocket area, contacts a cushion or jaw and is not potted. Filled balls mark their starting positions; the pink trace includes later rebounds.</p>
      <p>{result?.selected.plan.id === option.id ? `You chose reference plant finish ${option.label}.` : `You chose another stroke; this comparison uses plant finish ${option.label}.`} The miss is preserved, not corrected into a pot. Compare the regular trial results with free ball 3; this one nominal example is not a success-rate estimate.</p>
      <Button size="sm" variant="outline" onClick={() => { setRetry(true); setPrediction(null) }}>Try the prediction again</Button>
    </>}
    {result && retry && <Button size="sm" onClick={() => setRetry(false)}>Check prediction</Button>}
    <p className="lesson-comparison-note">This prediction is optional and never blocks advancement.</p>
  </section>
}
