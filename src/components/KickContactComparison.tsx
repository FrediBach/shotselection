import { useId, useState } from 'react'
import { Button } from './ui/button'
import { TABLE, POCKETS } from '../engine/constants'
import { POCKET_GEOMETRY } from '../engine/table-geometry'
import type { PreparedRound, RoundAnalysis, Vec2 } from '../engine/types'

const points = (path: Vec2[]) => path.map(p => `${p.x},${p.y}`).join(' ')
export default function KickContactComparison({ prepared, result, hidden, busy }: { prepared: PreparedRound; result: RoundAnalysis | null; hidden: boolean; busy: boolean }) {
  const [prediction, setPrediction] = useState<number | null>(null), [retry, setRetry] = useState(false)
  const marker = useId(), e = prepared.kickContact!, revealed = Boolean(result) && !retry
  const reference = prepared.balls[0].options.find(o => o.id === e.referenceId)!
  const nominal = result?.candidates.find(c => c.plan.id === e.referenceId)?.nominal
  const correct = prepared.scenario.seed % 2 === 0 ? 2 : 1
  const choices = [1, 2].map(number => ({ number, good: number === correct, end: number === correct ? e.ghost : e.centerHit, color: number === 1 ? '#7de3ef' : '#ff9f98' }))
  const pocketName = POCKETS.find(p => p.id === e.pocketId)!.name
  return <section className="lesson-comparison" aria-label="Kick contact comparison" hidden={hidden}>
    <h3>Reach the potting side</h3>
    <p>For finish {reference.label}, the target is the {pocketName} pocket. Which illustrated final leg reaches the side of ball 1 needed to send it toward that pocket?</p>
    <p>Both lines start at the same recorded rebound R1. These are geometry sketches, not two additional offered strokes. The dotted gold guide points from ball 1 toward the target pocket.</p>
    <figure><figcaption>Reference finish {reference.label} · Rebound and target pocket</figcaption>
      <svg viewBox="-.08 -.08 2.70 1.43" role="img" aria-label="Kick contact: rebound and target pocket">
        <rect width="2.54" height="1.27" rx=".04" fill="#143f38" />
        {POCKET_GEOMETRY.map(p => <circle key={p.id} cx={p.center.x} cy={p.center.y} r=".045" fill="#071e1b" />)}
        <circle cx={e.pocket.x} cy={e.pocket.y} r=".065" fill="none" stroke="#ffc16e" strokeWidth=".012" />
        <polyline points={points(e.approach)} fill="none" stroke="#ccc" strokeWidth=".008" />
        {choices.map(c => <polyline key={c.number} points={points([e.rebound, c.end])} fill="none" stroke={c.color} strokeWidth=".009" />)}
        <polyline points={points([e.object, e.pocket])} fill="none" stroke="#ffc16e" strokeWidth=".008" strokeDasharray=".02 .02" />
        {revealed && nominal && <polyline data-testid="kick-contact-object-path" points={points(nominal.objectPath)} fill="none" stroke="#ffc16e" strokeWidth=".012" />}
        {prepared.scenario.balls.map(b => <g key={b.id}><circle cx={b.position.x} cy={b.position.y} r={TABLE.ballRadius} fill={b.id === 0 ? '#fff' : b.id === 1 ? '#ffc16e' : '#ff9f98'} /><text x={b.position.x} y={b.position.y + .014} textAnchor="middle" fontSize=".043" fill="#071e1b">{b.id || ''}</text></g>)}
        <g transform={`translate(${e.rebound.x} ${e.rebound.y})`}><circle r=".065" fill="#071e1b" stroke="#fff" strokeWidth=".007" /><text y=".016" textAnchor="middle" fontSize=".045" fill="#fff">R1</text></g>
      </svg>
    </figure>
    {choices.map(c => <figure key={c.number}><figcaption><strong>Line {c.number} · Contact close-up</strong></figcaption>
      <svg viewBox={`${e.object.x - .16} ${e.object.y - .16} .32 .32`} role="img" aria-label={`Line ${c.number}: ${revealed ? 'contact overlay and departure direction' : 'illustrated final approach'}`}>
        <defs><marker id={`${marker}-${c.number}`} markerWidth="4" markerHeight="4" refX="3" refY="2" orient="auto"><path d="M0,0 L4,2 L0,4 Z" fill="#ffc16e" /></marker></defs>
        <rect x={e.object.x - .16} y={e.object.y - .16} width=".32" height=".32" fill="#143f38" />
        <polyline points={points([e.object, e.pocket])} fill="none" stroke="#ffc16e" strokeWidth=".0015" strokeDasharray=".006 .005" />
        <polyline points={points([e.rebound, c.end])} fill="none" stroke={c.color} strokeWidth=".0025" />
        <circle cx={e.object.x} cy={e.object.y} r={TABLE.ballRadius} fill="#ffc16e" />
        <text x={e.object.x} y={e.object.y + .006} fontSize=".018" textAnchor="middle" fill="#071e1b">1</text>
        {revealed && <>
          <circle data-testid={`kick-contact-center-${c.number}`} cx={c.end.x} cy={c.end.y} r={TABLE.ballRadius} fill="none" stroke={c.color} strokeWidth=".002" />
          <circle cx={(c.end.x + e.object.x) / 2} cy={(c.end.y + e.object.y) / 2} r=".003" fill="#fff" />
          <polyline points={points([e.object, { x: e.object.x + (c.good ? e.direction : e.centerDirection).x * .135, y: e.object.y + (c.good ? e.direction : e.centerDirection).y * .135 }])} fill="none" stroke="#ffc16e" strokeWidth=".0025" markerEnd={`url(#${marker}-${c.number})`} />
        </>}
      </svg>
      {revealed && <p>{c.good ? 'The cue-ball center reaches the ghost-ball position behind the target. The contact point lines up with the pocket.' : `Aiming at ball 1’s center still makes contact, but its line of centers points ${e.angle.toFixed(1)}° away from the pocket direction.`}</p>}
    </figure>)}
    <div className="lesson-predictions" role="group" aria-label="Kick contact prediction">{choices.map(c => <Button key={c.number} size="sm" variant={prediction === c.number ? 'default' : 'outline'} aria-pressed={prediction === c.number} disabled={busy || revealed} onClick={() => setPrediction(c.number)}>Line {c.number}</Button>)}</div>
    {revealed && <>
      <p role="status"><strong>{prediction === null ? `Line ${correct} reaches the potting side.` : prediction === correct ? `Correct: line ${correct} reaches the potting side.` : `Line ${correct}, rather than the center-directed line, reaches the potting side.`}</strong></p>
      <p>The outlined circle is the cue ball at geometric contact; the white dot is the surface contact point. Gold arrows follow the line of centers, the ideal collision direction. They omit throw and are not simulated outcomes.</p>
      <p>The full-table gold path is finish {reference.label}’s actual simulation: ball 1 is potted without a scratch. Its calibrated contact can differ slightly from ideal geometry. The center-directed sketch has no simulated outcome and need not be achievable with the same incoming stroke.</p>
      <p>{result?.selected.plan.id === e.referenceId ? `You chose reference finish ${reference.label}.` : `You chose a different finish; this geometry example uses finish ${reference.label}.`} All three offered finishes remain nominally playable. Choose the most forgiving complete stroke in the regular task.</p>
      <Button size="sm" variant="outline" onClick={() => { setRetry(true); setPrediction(null) }}>Try the prediction again</Button>
    </>}
    {result && retry && <Button size="sm" onClick={() => setRetry(false)}>Check prediction</Button>}
    <p className="lesson-comparison-note">This prediction is optional and never blocks advancement.</p>
  </section>
}
