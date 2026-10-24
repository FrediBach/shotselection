import { useId, useState } from 'react'
import { Button } from './ui/button'
import { kickFinishEvidence } from '../engine/kick-finish'
import { TABLE } from '../engine/constants'
import { POCKET_GEOMETRY } from '../engine/table-geometry'
import { normalize } from '../engine/math'
import type { PreparedRound, RoundAnalysis, Vec2 } from '../engine/types'
const points = (p: Vec2[]) => p.map(v => `${v.x},${v.y}`).join(' ')
const spin = (v: number) => `${Math.round(Math.abs(v) * 100)}% ${v < 0 ? 'draw' : 'follow'}`
export default function KickFinishComparison({ prepared, result, hidden, busy }: { prepared: PreparedRound; result: RoundAnalysis | null; hidden: boolean; busy: boolean }) {
  const [prediction, setPrediction] = useState<number | null>(null), [retry, setRetry] = useState(false)
  const marker = useId(), x = prepared.kickFinish!, option = prepared.balls[0].options.find(o => o.id === x.referenceId)!
  const e = kickFinishEvidence(prepared.scenario, option.plan, x)!, revealed = Boolean(result) && !retry
  const safe = prepared.scenario.seed % 2 ? 1 : 2, risky = 3 - safe
  const variants = [
    { n: safe, key: 'reference', plan: option.plan, simulation: x.reference, evidence: e.reference },
    { n: risky, key: 'scratch', plan: x.scratchPlan, simulation: x.scratched, evidence: e.scratched },
  ].sort((a, b) => a.n - b.n)
  return <section className="lesson-comparison" aria-label="Kick finish comparison" hidden={hidden}>
    <h3>Read the final approach, then the departure</h3>
    <p>Both kicks pot the same ball 1 into the gold-ringed pocket from identical starting positions. Which stroke also scratches?</p>
    <p>White shows launch travel; cyan marks the final approach after R1. The cyan arrow uses the recorded incoming direction at contact. Pace and spin differ too: compare the complete strokes, not direction alone. Route {safe} is offered finish {option.label}; route {risky} is a separate unscored demonstration.</p>
    {variants.map(v => {
      const { contact, rebound, approach, departure } = v.evidence, incoming = normalize(contact.incoming), outgoing = normalize(contact.outgoing)
      const arrow = (d: Vec2, before: boolean) => before ? [{ x: contact.position.x - .16 * d.x, y: contact.position.y - .16 * d.y }, contact.position] : [contact.position, { x: contact.position.x + .13 * d.x, y: contact.position.y + .13 * d.y }]
      return <figure key={v.key}><figcaption><strong>Route {v.n} · {v.plan.speed.toFixed(2)} m/s · {spin(v.plan.topSpin)}</strong></figcaption>
        <svg viewBox="-.08 -.08 2.70 1.43" role="img" aria-label={`Route ${v.n}: kick approach${revealed ? ' and departure' : ''}`}>
          <defs>{['in', 'out'].map(k => <marker key={k} id={`${marker}-${v.key}-${k}`} markerWidth="3" markerHeight="3" refX="2.5" refY="1.5" orient="auto"><path d="M0,0 L3,1.5 L0,3 Z" fill={k === 'in' ? '#7de3ef' : '#ff9f98'} /></marker>)}</defs>
          <rect width="2.54" height="1.27" rx=".04" fill="#143f38" />
          {POCKET_GEOMETRY.map(p => <circle key={p.id} cx={p.center.x} cy={p.center.y} r=".045" fill="#071e1b" stroke={p.id === option.plan.pocketId ? '#ffc16e' : 'none'} strokeWidth=".009" />)}
          <polyline points={points(v.simulation.cueApproachPath)} fill="none" stroke="#fff" strokeWidth=".006" />
          <polyline data-testid={`kick-finish-approach-${v.key}`} points={points(approach)} fill="none" stroke="#7de3ef" strokeWidth=".009" />
          {revealed && <>
            <polyline points={points(v.simulation.objectPath)} fill="none" stroke="#ffc16e" strokeWidth=".006" strokeDasharray=".015 .01" />
            <polyline data-testid={`kick-finish-departure-${v.key}`} points={points(departure)} fill="none" stroke="#ff9f98" strokeWidth=".009" />
            <polyline points={points(arrow(outgoing, false))} fill="none" stroke="#ff9f98" strokeWidth=".005" markerEnd={`url(#${marker}-${v.key}-out)`} />
            <circle data-testid={`kick-finish-end-${v.key}`} cx={v.simulation.cueEnd.x} cy={v.simulation.cueEnd.y} r=".018" fill="#ff9f98" />
          </>}
          {prepared.scenario.balls.map(b => <g key={b.id}><circle cx={b.position.x} cy={b.position.y} r={TABLE.ballRadius} fill={b.id === 0 ? '#fff' : b.id === 1 ? '#ffc16e' : '#aaa'} /><text x={b.position.x} y={b.position.y + .014} textAnchor="middle" fontSize=".043" fill="#071e1b">{b.id || ''}</text></g>)}
          <polyline points={points(arrow(incoming, true))} fill="none" stroke="#7de3ef" strokeWidth=".006" markerEnd={`url(#${marker}-${v.key}-in)`} />
          <circle cx={contact.position.x} cy={contact.position.y} r=".012" fill="#fff" />
          <g transform={`translate(${rebound.position.x} ${rebound.position.y})`}><circle r=".06" fill="#071e1b" stroke="#7de3ef" strokeWidth=".006" /><text y=".015" textAnchor="middle" fontSize=".043" fill="#fff">R1</text></g>
        </svg>
        {revealed && <p>{v.n === risky ? 'Ball 1 is potted, but the cue ball follows into the same pocket: scratch.' : 'Ball 1 is potted and the cue ball settles without scratching.'}</p>}
      </figure>
    })}
    <div className="lesson-predictions" role="group" aria-label="Kick finish prediction">{[1, 2].map(n => <Button key={n} size="sm" variant={prediction === n ? 'default' : 'outline'} aria-pressed={prediction === n} disabled={busy || revealed} onClick={() => setPrediction(n)}>Route {n}</Button>)}</div>
    {revealed && <>
      <p role="status"><strong>{prediction === null ? `Route ${risky} scratches.` : prediction === risky ? `Correct: route ${risky} scratches.` : `Route ${safe} avoids the scratch; route ${risky} scratches.`}</strong></p>
      <p>The directions arriving at ball 1 differ by {e.approachAngle.toFixed(1)}°. On the scratching stroke, the incoming direction differs from launch by {e.launchAngle.toFixed(1)}°. Read contact from the final leg after the rail, then account for speed and spin.</p>
      <p>Pink traces actual cue-ball departure; the pink arrow shows its immediate direction after impact. The path can curve as spin evolves. Gold dashes trace ball 1’s pot. These are nominal outcomes, not scratch probabilities or a universal 90° rule.</p>
      <p>{result?.selected.plan.id === option.id ? `You chose reference finish ${option.label}.` : `You chose another finish; this comparison uses finish ${option.label}.`}</p>
      <Button size="sm" variant="outline" onClick={() => { setRetry(true); setPrediction(null) }}>Try the prediction again</Button>
    </>}
    {result && retry && <Button size="sm" onClick={() => setRetry(false)}>Check prediction</Button>}
    <p className="lesson-comparison-note">This prediction is optional and never blocks advancement.</p>
  </section>
}
