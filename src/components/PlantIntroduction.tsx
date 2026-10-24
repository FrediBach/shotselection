import { useId, useState } from 'react'
import { Button } from './ui/button'
import { plantIntroductionEvidence } from '../engine/plant-introduction'
import { TABLE } from '../engine/constants'
import { POCKET_GEOMETRY } from '../engine/table-geometry'
import { normalize } from '../engine/math'
import type { PreparedRound, RoundAnalysis, Vec2 } from '../engine/types'
const points = (p: Vec2[]) => p.map(v => `${v.x},${v.y}`).join(' ')
export default function PlantIntroduction({ prepared, result, hidden, busy }: { prepared: PreparedRound; result: RoundAnalysis | null; hidden: boolean; busy: boolean }) {
  const [prediction, setPrediction] = useState<number | null>(null), [retry, setRetry] = useState(false), [step, setStep] = useState(0)
  const marker = useId(), x = prepared.plantIntroduction!, option = prepared.balls.find(b => b.ballId === 1)!.options.find(o => o.id === x.referenceId)!
  const e = plantIntroductionEvidence(prepared.scenario, option.plan, x.simulation)!, revealed = Boolean(result) && !retry
  const event = step === 0 ? e.first : e.transfer, movingIndex = step === 0 ? 0 : e.firstIndex
  const center = { x: (event.positions[0].x + event.positions[1].x) / 2, y: (event.positions[0].y + event.positions[1].y) / 2 }
  const incoming = normalize(event.incoming[movingIndex]), moving = event.positions[movingIndex]
  return <section className="lesson-comparison" aria-label="Plant contact introduction" hidden={hidden}>
    <h3>One ball sends another to the pocket</h3>
    <p>For the plant 1 → 2, the cue ball strikes ball 1 first. Which ball then receives the second contact and is the intended pot: ball 1 or ball 2?</p>
    <p>Use plant finish {option.label} as the reference. Free ball 3 remains a separate direct-shot alternative; compare both complete strokes after reading the plant’s contact sequence.</p>
    <div role="group" className="lesson-predictions" aria-label="Plant target prediction">{[1, 2].map(id => <Button key={id} size="sm" variant={prediction === id ? 'default' : 'outline'} aria-pressed={prediction === id} disabled={busy || revealed} onClick={() => setPrediction(id)}>Ball {id}</Button>)}</div>
    {revealed && <>
      <p role="status"><strong>{prediction === null ? 'Ball 2 is the plant’s potting target.' : prediction === 2 ? 'Correct: ball 2 is the plant’s potting target.' : 'Ball 1 transfers motion; ball 2 is the potting target.'}</strong></p>
      <ol><li>Contact 1: cue → ball 1 at {e.first.time.toFixed(3)} s.</li><li>Contact 2: ball 1 → ball 2 at {e.transfer.time.toFixed(3)} s.</li><li>Ball 2 is potted into the highlighted pocket without a scratch in this reference simulation.</li></ol>
      <div className="lesson-predictions" role="group" aria-label="Inspect plant contacts">{[0, 1].map(i => <Button key={i} size="sm" variant={step === i ? 'default' : 'outline'} aria-pressed={step === i} onClick={() => setStep(i)}>Contact {i + 1}</Button>)}</div>
      <figure><figcaption><strong>Contact {step + 1} · {step === 0 ? 'Cue → ball 1' : 'Ball 1 → ball 2'} · {event.time.toFixed(3)} s</strong></figcaption>
        <svg viewBox={`${center.x - .12} ${center.y - .12} .24 .24`} role="img" aria-label={`Contact ${step + 1}: recorded ball centers immediately before collision resolution`}>
          <defs><marker id={marker} markerWidth="4" markerHeight="4" refX="3" refY="2" orient="auto"><path d="M0,0 L4,2 L0,4 Z" fill="#fff" /></marker></defs>
          <rect x={center.x - .12} y={center.y - .12} width=".24" height=".24" fill="#143f38" />
          <polyline data-testid="plant-incoming-arrow" points={points([{ x: moving.x - incoming.x * .075, y: moving.y - incoming.y * .075 }, { x: moving.x - incoming.x * .035, y: moving.y - incoming.y * .035 }])} fill="none" stroke="#fff" strokeWidth=".002" markerEnd={`url(#${marker})`} />
          {event.ballIds.map((id, i) => <g key={id}><circle data-testid={`plant-contact-ball-${id}`} cx={event.positions[i].x} cy={event.positions[i].y} r={TABLE.ballRadius} fill={id === 0 ? '#fff' : id === 1 ? '#7de3ef' : '#ffc16e'} /><text x={event.positions[i].x} y={event.positions[i].y + .006} textAnchor="middle" fontSize={id === 0 ? '.013' : '.02'} fill="#071e1b">{id || 'Cue'}</text></g>)}
        </svg>
      </figure>
      <p>These are two recorded contact snapshots, with time measured from launch. The white arrow shows the moving ball’s incoming direction. At contact 1 the cue ball moves into stationary ball 1; at contact 2 ball 1 moves into stationary ball 2.</p>
      <figure><figcaption><strong>Reference plant · Ball 2’s actual pot path</strong></figcaption>
        <svg viewBox="-.08 -.08 2.70 1.43" role="img" aria-label="Reference plant: cue approach to ball 1 and ball 2 path to the pocket">
          <rect width="2.54" height="1.27" rx=".04" fill="#143f38" />
          {POCKET_GEOMETRY.map(p => <circle key={p.id} cx={p.center.x} cy={p.center.y} r=".045" fill="#071e1b" stroke={p.id === e.pocket.id ? '#ffc16e' : 'none'} strokeWidth=".008" />)}
          <polyline data-testid="plant-cue-approach" points={points(x.simulation.cueApproachPath)} fill="none" stroke="#fff" strokeWidth=".008" />
          <polyline data-testid="plant-target-path" points={points(x.simulation.objectPath)} fill="none" stroke="#ffc16e" strokeWidth=".009" />
          {prepared.scenario.balls.map(b => <g key={b.id}><circle cx={b.position.x} cy={b.position.y} r={TABLE.ballRadius} fill={b.id === 0 ? '#fff' : b.id === 1 ? '#7de3ef' : b.id === 2 ? '#ffc16e' : '#9aa9a4'} /><text x={b.position.x} y={b.position.y + .014} textAnchor="middle" fontSize=".043" fill="#071e1b">{b.id || ''}</text></g>)}
        </svg>
      </figure>
      <p>Filled balls in the full-table view mark their starting positions. White traces the cue ball only to its first contact; gold traces ball 2. Ball 1’s short transfer travel and later cue-ball travel are omitted; inspect the two contact snapshots for the transfer.</p>
      <p>{result?.selected.plan.id === option.id ? `You chose reference plant finish ${option.label}.` : `You chose another stroke; these snapshots use plant finish ${option.label}.`} The reference verifies cue → 1 → 2 and the target pot. One successful example does not establish reliability; compare the regular plant and free-ball trial results.</p>
      <Button size="sm" variant="outline" onClick={() => { setRetry(true); setPrediction(null); setStep(0) }}>Try the prediction again</Button>
    </>}
    {result && retry && <Button size="sm" onClick={() => setRetry(false)}>Check prediction</Button>}
    <p className="lesson-comparison-note">This prediction is optional and never blocks advancement.</p>
  </section>
}
