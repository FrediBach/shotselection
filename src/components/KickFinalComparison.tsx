import { useId, useState } from 'react'
import { Button } from './ui/button'
import { kickFinalEvidence } from '../engine/kick-final'
import { TABLE } from '../engine/constants'
import { POCKET_GEOMETRY } from '../engine/table-geometry'
import { normalize } from '../engine/math'
import type { PreparedRound, RoundAnalysis, Vec2 } from '../engine/types'
const points = (path: Vec2[]) => path.map(p => `${p.x},${p.y}`).join(' ')
export default function KickFinalComparison({ prepared, result, hidden, busy }: { prepared: PreparedRound; result: RoundAnalysis | null; hidden: boolean; busy: boolean }) {
  const [prediction, setPrediction] = useState<string | null>(null), [retry, setRetry] = useState(false)
  const marker = useId(), x = prepared.kickFinal!, option = prepared.balls[0].options.find(o => o.id === x.referenceId)!
  const e = kickFinalEvidence(prepared.scenario, option.plan, x.simulation)!, revealed = Boolean(result) && !retry
  const actual = prepared.scenario.seed % 2 ? 'A' : 'B', other = actual === 'A' ? 'B' : 'A'
  const incoming = normalize(e.contact.incoming), directions = ['A', 'B'].map(label => ({ label, direction: label === actual ? incoming : e.launch }))
  return <section className="lesson-comparison" aria-label="Three-cushion final approach" hidden={hidden}>
    <h3>Read the approach after R3</h3>
    <p>Trace reference finish {option.label} through R1, R2 and R3. Which arrow below shows the cue ball’s incoming direction when it reaches ball 1?</p>
    <figure><figcaption><strong>Finish {option.label} · Three recorded rebounds</strong></figcaption>
      <svg viewBox="-.10 -.10 2.74 1.47" role="img" aria-label="Cue-ball route through R1, R2 and R3 to ball 1">
        <rect width="2.54" height="1.27" rx=".04" fill="#143f38" />
        {POCKET_GEOMETRY.map(p => <circle key={p.id} cx={p.center.x} cy={p.center.y} r=".045" fill="#071e1b" />)}
        {e.legs.map((leg, i) => <polyline key={i} data-testid={`final-leg-${i + 1}`} points={points(leg)} fill="none" stroke={revealed && i === 3 ? '#ffc16e' : '#7de3ef'} strokeWidth={revealed && i === 3 ? '.013' : '.008'} />)}
        {revealed && <polyline data-testid="final-object-path" points={points(x.simulation.objectPath)} fill="none" stroke="#ffc16e" strokeWidth=".007" strokeDasharray=".02 .015" />}
        {prepared.scenario.balls.map(b => <g key={b.id}><circle cx={b.position.x} cy={b.position.y} r={TABLE.ballRadius} fill={b.id === 0 ? '#fff' : b.id === 1 ? '#ffc16e' : '#9aa9a4'} fillOpacity={b.id > 1 ? .4 : 1} />{b.id === 1 && <text x={b.position.x} y={b.position.y + .014} textAnchor="middle" fontSize=".043" fill="#071e1b">1</text>}</g>)}
        {e.rebounds.map((r, i) => <g key={i} data-testid={`final-rebound-${i + 1}`} transform={`translate(${r.position.x} ${r.position.y})`}><circle r=".06" fill="#071e1b" stroke="#fff" strokeWidth=".006" /><text y=".015" textAnchor="middle" fontSize=".043" fill="#fff">R{i + 1}</text></g>)}
      </svg>
    </figure>
    <figure><figcaption><strong>Incoming direction at contact</strong></figcaption>
      <svg viewBox="-.20 -.20 .40 .40" role="img" aria-label="Compare incoming arrows A and B at the cue-ball contact center">
        <defs>{directions.map(v => <marker key={v.label} id={`${marker}-${v.label}`} markerWidth="4" markerHeight="4" refX="3" refY="2" orient="auto"><path d="M0,0 L4,2 L0,4 Z" fill={revealed && v.label !== actual ? '#aaa' : v.label === 'A' ? '#7de3ef' : '#ff9f98'} /></marker>)}</defs>
        <rect x="-.2" y="-.2" width=".4" height=".4" fill="#143f38" />
        <circle cx={e.contact.otherPosition.x - e.contact.position.x} cy={e.contact.otherPosition.y - e.contact.position.y} r={TABLE.ballRadius} fill="#ffc16e" />
        <text x={e.contact.otherPosition.x - e.contact.position.x} y={e.contact.otherPosition.y - e.contact.position.y + .007} textAnchor="middle" fontSize=".022" fill="#071e1b">1</text>
        {directions.map(v => <g key={v.label}>
          <polyline data-testid={`final-arrow-${v.label}`} points={points([{ x: -v.direction.x * .13, y: -v.direction.y * .13 }, { x: -v.direction.x * .018, y: -v.direction.y * .018 }])} fill="none" stroke={revealed && v.label !== actual ? '#aaa' : v.label === 'A' ? '#7de3ef' : '#ff9f98'} strokeWidth=".003" strokeDasharray={revealed && v.label !== actual ? '.006 .004' : undefined} markerEnd={`url(#${marker}-${v.label})`} />
          <text x={-v.direction.x * .16} y={-v.direction.y * .16 + .007} textAnchor="middle" fontSize=".025" fill="#fff">{v.label}</text>
        </g>)}
        <circle r={TABLE.ballRadius} fill="none" stroke="#fff" strokeWidth=".0015" />
        <circle r=".006" fill="#fff" />
      </svg>
    </figure>
    <p>The white dot is the cue-ball center at contact; the white ring shows its size. Both arrows point toward that center and are drawn at equal length to compare direction, not speed. Ball 1 is shown at contact.</p>
    <div role="group" className="lesson-predictions" aria-label="Final approach prediction">{['A', 'B'].map(label => <Button key={label} size="sm" variant={prediction === label ? 'default' : 'outline'} aria-pressed={prediction === label} disabled={busy || revealed} onClick={() => setPrediction(label)}>Arrow {label}</Button>)}</div>
    {revealed && <>
      <p role="status"><strong>{prediction === null ? `Arrow ${actual} shows the final approach.` : prediction === actual ? `Correct: arrow ${actual} shows the final approach.` : `Arrow ${other} is the launch direction; arrow ${actual} shows the final approach.`}</strong></p>
      <p>The incoming direction is measured immediately before contact after R3. Arrow {other} copies the launch direction into this inset for comparison; it is not a second simulated route. The directions differ by {e.angle.toFixed(1)}°. Use the final leg to read the collision.</p>
      <ol>{e.rebounds.map((r, i) => <li key={i}>R{i + 1}: {r.time.toFixed(2)} s after launch.</li>)}<li>First object-ball contact: ball 1 at {e.contact.time.toFixed(2)} s.</li></ol>
      <p>All three rebounds happen before first contact. The gold solid line highlights the actual final approach; gold dashes show ball 1’s pot. This reference pots ball 1 without scratching. Later cue-ball travel is omitted from the diagram.</p>
      <p>{result?.selected.plan.id === option.id ? `You chose reference finish ${option.label}.` : `You chose another finish; this diagram uses finish ${option.label}.`} The arrow prediction does not measure reliability; compare the regular trials for the complete strokes.</p>
      <Button size="sm" variant="outline" onClick={() => { setRetry(true); setPrediction(null) }}>Try the prediction again</Button>
    </>}
    {result && retry && <Button size="sm" onClick={() => setRetry(false)}>Check prediction</Button>}
    <p className="lesson-comparison-note">This prediction is optional and never blocks advancement.</p>
  </section>
}
