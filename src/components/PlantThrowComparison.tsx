import { useState } from 'react'
import { Button } from './ui/button'
import { plantThrowEvidence } from '../engine/plant-throw'
import { TABLE } from '../engine/constants'
import { CUSHIONS, POCKET_GEOMETRY } from '../engine/table-geometry'
import type { PreparedRound, RoundAnalysis, Vec2 } from '../engine/types'
const points = (p: Vec2[]) => p.map(v => `${v.x},${v.y}`).join(' ')
export default function PlantThrowComparison({ prepared, result, hidden, busy }: { prepared: PreparedRound; result: RoundAnalysis | null; hidden: boolean; busy: boolean }) {
  const [prediction, setPrediction] = useState<string | null>(null), [retry, setRetry] = useState(false), [detail, setDetail] = useState(true)
  const x = prepared.plantThrow!, option = prepared.balls.find(b => b.ballId === 1)!.options.find(o => o.id === x.referenceId)!
  const e = plantThrowEvidence(prepared.scenario, option.plan, x)!, revealed = Boolean(result) && !retry
  const target = e.transfer.positions[1], first = e.transfer.positions[0], mouth = e.geometry.pocket.mouthCenter
  const ray = (d: Vec2) => [target, { x: target.x + d.x * .16, y: target.y + d.y * .16 }]
  const center = { x: (first.x + ray(e.outgoing)[1].x) / 2, y: (first.y + ray(e.outgoing)[1].y) / 2 }
  return <section className="lesson-comparison" aria-label="Plant collision-throw comparison" hidden={hidden}>
    <h3>An aligned pair can still throw</h3>
    <p>The initial pair line points at the pocket center. At an oblique transfer, must ball 2 leave exactly along the line joining the two contact centers, or can collision friction deflect it?</p>
    <div role="group" className="lesson-predictions" aria-label="Collision-throw prediction">{['Follows contact-center line', 'Friction can deflect it'].map(answer => <Button key={answer} size="sm" variant={prediction === answer ? 'default' : 'outline'} aria-pressed={prediction === answer} disabled={busy || revealed} onClick={() => setPrediction(answer)}>{answer}</Button>)}</div>
    {revealed && <>
      <p role="status"><strong>{prediction === 'Friction can deflect it' ? 'Correct: collision friction deflects ball 2.' : 'Collision friction deflects ball 2.'}</strong></p>
      <p>Reference plant finish {option.label} contacts ball 1 at {e.first.time.toFixed(3)} s, then transfers motion to ball 2 at {e.transfer.time.toFixed(3)} s. Ball 1 arrives {e.oblique.toFixed(2)}° across the contact-center line; ball 2 is stationary before impact.</p>
      <figure><figcaption><strong>At transfer · Three different directions</strong></figcaption>
        <svg viewBox={`${center.x - .15} ${center.y - .15} .30 .30`} role="img" aria-label="Transfer snapshot: initial pair, contact normal and actual outgoing direction">
          <rect x={center.x - .15} y={center.y - .15} width=".30" height=".30" fill="#143f38" />
          <polyline data-testid="throw-contact-centers" points={points([first, target])} fill="none" stroke="#7de3ef" strokeWidth=".002" />
          <polyline data-testid="throw-pair-direction" points={points(ray(e.geometry.direction))} fill="none" stroke="#fff" strokeWidth=".002" strokeDasharray=".007 .005" />
          <polyline data-testid="throw-normal-direction" points={points(ray(e.normal))} fill="none" stroke="#7de3ef" strokeWidth=".002" />
          <polyline data-testid="throw-outgoing-direction" points={points(ray(e.outgoing))} fill="none" stroke="#ffc16e" strokeWidth=".002" />
          {([[1, first], [2, target]] as const).map(([id, v]) => <g key={id}><circle data-testid={`throw-contact-ball-${id}`} cx={v.x} cy={v.y} r={TABLE.ballRadius} fill={id === 1 ? '#7de3ef' : '#ffc16e'} /><text x={v.x} y={v.y + .007} textAnchor="middle" fontSize=".023" fill="#071e1b">{id}</text></g>)}
        </svg>
      </figure>
      <ol><li><strong>White dashes:</strong> the initial pair direction.</li><li><strong>Cyan:</strong> the line through the recorded centers at transfer, also the friction-free outgoing direction.</li><li><strong>Gold:</strong> ball 2’s actual outgoing velocity immediately after collision resolution.</li></ol>
      <p>Delivery moves the contact-center line {e.deliveryAngle.toFixed(2)}° away from the initial pair direction. Friction then adds a {e.throwAngle.toFixed(2)}° deflection from the contact-center line. The first difference is not itself proof of throw; the friction-controlled comparison isolates the second.</p>
      <p>The diagnostic run removes tangential friction only between balls 1 and 2. Their incoming positions, velocities and contact times match the ordinary run; restitution, cloth, cushions and all other ball-pair friction remain unchanged. Its target direction differs from the contact-center line by less than 0.01°. This diagnostic is not an offered stroke.</p>
      <div role="group" className="lesson-predictions" aria-label="Inspect throw paths"><Button size="sm" variant={detail ? 'default' : 'outline'} aria-pressed={detail} onClick={() => setDetail(true)}>Pocket detail</Button><Button size="sm" variant={!detail ? 'default' : 'outline'} aria-pressed={!detail} onClick={() => setDetail(false)}>Full table</Button></div>
      <figure><figcaption><strong>Actual and friction-free transfer · Both pot</strong></figcaption>
        <svg viewBox={detail ? `${mouth.x - .13} ${mouth.y - .13} .26 .26` : '-.08 -.08 2.70 1.43'} role="img" aria-label="Target paths with ordinary and friction-free plant transfer">
          <rect x="-.2" y="-.2" width="2.94" height="1.67" fill="#0b241f" /><rect width="2.54" height="1.27" fill="#143f38" />
          {CUSHIONS.map(c => <polygon key={c.id} points={points(c.polygon)} fill="#205247" stroke="#8aa99f" strokeWidth=".002" />)}
          {POCKET_GEOMETRY.map(p => <circle key={p.id} cx={p.center.x} cy={p.center.y} r={p.radius} fill="#061713" />)}
          <polyline data-testid="throw-control-path" points={points(x.frictionless.objectPath)} fill="none" stroke="#7de3ef" strokeWidth={detail ? '.002' : '.006'} />
          <polyline data-testid="throw-actual-path" points={points(x.actual.objectPath)} fill="none" stroke="#ffc16e" strokeWidth={detail ? '.002' : '.006'} />
          <polyline data-testid="throw-initial-line" points={points([e.geometry.first, e.geometry.target, e.geometry.hit])} fill="none" stroke="#fff" strokeWidth=".002" strokeDasharray=".008 .006" />
          <polyline data-testid="throw-mouth" points={points(e.geometry.pocket.mouth)} fill="none" stroke="#7de3bf" strokeWidth=".003" />
          <polyline data-testid="throw-mouth-shift" points={points([e.controlHit, e.actualHit])} fill="none" stroke="#ff9f98" strokeWidth=".004" />
          {[e.controlHit, e.actualHit].map((v, i) => <circle key={i} cx={v.x} cy={v.y} r=".003" fill="#ff9f98" />)}
          {prepared.scenario.balls.map(b => <g key={b.id}><circle cx={b.position.x} cy={b.position.y} r={TABLE.ballRadius} fill={b.id === 0 ? '#fff' : b.id === 1 ? '#7de3ef' : b.id === 2 ? '#ffc16e' : '#9aa9a4'} /><text x={b.position.x} y={b.position.y + .009} textAnchor="middle" fontSize=".026" fill="#071e1b">{b.id || ''}</text></g>)}
        </svg>
      </figure>
      <p>Solid gold/cyan lines are simulated target paths with ordinary/friction-free transfer. White dashes show initial pair geometry. The pink segment measures {(e.mouthShift * 1000).toFixed(1)} mm between projections of the two immediate outgoing velocities onto the green mouth line. Those projections are not measured crossing points: subsequent motion can differ. Filled balls in this view mark starting positions.</p>
      <p>{result?.selected.plan.id === option.id ? `You chose reference plant finish ${option.label}.` : `You chose another stroke; this comparison uses plant finish ${option.label}.`} Both references pot ball 2; a visible throw does not guarantee a miss. This is a directional explanation, not a success-rate estimate. Compare the regular trials for cue-ball finish and complete-stroke reliability.</p>
      <Button size="sm" variant="outline" onClick={() => { setRetry(true); setPrediction(null); setDetail(true) }}>Try the prediction again</Button>
    </>}
    {result && retry && <Button size="sm" onClick={() => setRetry(false)}>Check prediction</Button>}
    <p className="lesson-comparison-note">This prediction is optional and never blocks advancement.</p>
  </section>
}
