import { useState } from 'react'
import { Button } from './ui/button'
import { kickSequenceEvidence } from '../engine/kick-sequence'
import { TABLE } from '../engine/constants'
import { POCKET_GEOMETRY } from '../engine/table-geometry'
import type { PreparedRound, RoundAnalysis, Vec2 } from '../engine/types'
const points = (path: Vec2[]) => path.map(p => `${p.x},${p.y}`).join(' ')
const colors = ['#fff', '#7de3ef', '#ffc16e']
export default function KickSequenceComparison({ prepared, result, hidden, busy }: { prepared: PreparedRound; result: RoundAnalysis | null; hidden: boolean; busy: boolean }) {
  const [prediction, setPrediction] = useState<string | null>(null), [retry, setRetry] = useState(false)
  const x = prepared.kickSequence!, option = prepared.balls[0].options.find(o => o.id === x.referenceId)!
  const e = kickSequenceEvidence(prepared.scenario, x.simulation)!, revealed = Boolean(result) && !retry
  return <section className="lesson-comparison" aria-label="Two-cushion sequence" hidden={hidden}>
    <h3>Trace two rebounds in order</h3>
    <p>Follow reference finish {option.label} from the white cue ball to ball 1. Which marked rail point comes first: A or B?</p>
    <p>The faint grey balls remain physical screens that block shorter routes. Focus on the three connected legs here; the next lesson inspects the corridor between rebounds.</p>
    <figure><figcaption><strong>Finish {option.label} · {revealed ? 'R1 → R2 → ball 1' : 'Two marked rail points'}</strong></figcaption>
      <svg viewBox="-.10 -.10 2.74 1.47" role="img" aria-label={revealed ? 'Recorded kick sequence: R1 then R2 then ball 1' : 'Trace the cue ball through rail points A and B'}>
        <rect width="2.54" height="1.27" rx=".04" fill="#143f38" />
        {POCKET_GEOMETRY.map(p => <circle key={p.id} cx={p.center.x} cy={p.center.y} r=".045" fill="#071e1b" />)}
        {prepared.scenario.balls.filter(b => b.id > 1).map(b => <circle data-testid="sequence-screen" key={b.id} cx={b.position.x} cy={b.position.y} r={TABLE.ballRadius} fill="#b5c1bc" fillOpacity=".25" />)}
        {revealed && <polyline data-testid="sequence-object-path" points={points(x.simulation.objectPath)} fill="none" stroke="#ffc16e" strokeWidth=".007" strokeDasharray=".018 .012" />}
        {e.legs.map((leg, i) => <polyline key={i} data-testid={`sequence-leg-${i + 1}`} points={points(leg)} fill="none" stroke={revealed ? colors[i] : '#7de3ef'} strokeWidth=".010" />)}
        {prepared.scenario.balls.filter(b => b.id <= 1).map(b => <g key={b.id}><circle cx={b.position.x} cy={b.position.y} r={TABLE.ballRadius} fill={b.id === 0 ? '#fff' : '#ffc16e'} /><text x={b.position.x} y={b.position.y + .014} textAnchor="middle" fontSize=".043" fill="#071e1b">{b.id || ''}</text></g>)}
        {[e.first, e.second].map((r, i) => <g data-testid={`sequence-rebound-${i + 1}`} key={i} transform={`translate(${r.position.x} ${r.position.y})`}><circle r=".07" fill="#071e1b" stroke={revealed ? colors[i] : '#7de3ef'} strokeWidth=".007" /><text y=".017" textAnchor="middle" fontSize=".05" fill="#fff">{revealed ? `R${i + 1}` : i === 0 ? e.firstLabel : e.secondLabel}</text></g>)}
        {revealed && <circle data-testid="sequence-contact" cx={e.contact.position.x} cy={e.contact.position.y} r={TABLE.ballRadius} fill="none" stroke="#fff" strokeWidth=".006" />}
      </svg>
    </figure>
    <div className="lesson-predictions" role="group" aria-label="Rebound order prediction">{['A → B', 'B → A'].map(answer => <Button key={answer} size="sm" variant={prediction === answer ? 'default' : 'outline'} aria-pressed={prediction === answer} disabled={busy || revealed} onClick={() => setPrediction(answer)}>{answer}</Button>)}</div>
    {revealed && <>
      <p role="status"><strong>{prediction === null ? `The order is ${e.order}.` : prediction === e.order ? `Correct: ${e.order}.` : `Trace from the cue ball: ${e.order}.`}</strong></p>
      <ol>
        <li>White leg: cue ball → {e.firstLabel}, now R1, at {e.first.time.toFixed(2)} s.</li>
        <li>Cyan leg: R1 → {e.secondLabel}, now R2, at {e.second.time.toFixed(2)} s.</li>
        <li>Gold leg: R2 → ball 1, first contact at {e.contact.time.toFixed(2)} s.</li>
      </ol>
      <p>Both rebounds occur before the first object-ball contact. A later cushion would not count toward this requirement. The white ring marks the cue-ball center at contact; gold dashes trace ball 1’s pot. Later cue-ball travel is omitted to keep the sequence clear.</p>
      <p>These are recorded rebound positions and times from the nominal simulation of finish {option.label}. Ball 1 is potted without a scratch. {result?.selected.plan.id === option.id ? `You chose this reference finish.` : `You chose another finish; this diagram stays on reference ${option.label}.`} This trace does not measure reliability.</p>
      <Button size="sm" variant="outline" onClick={() => { setRetry(true); setPrediction(null) }}>Try the prediction again</Button>
    </>}
    {result && retry && <Button size="sm" onClick={() => setRetry(false)}>Check prediction</Button>}
    <p className="lesson-comparison-note">This prediction is optional and never blocks advancement.</p>
  </section>
}
