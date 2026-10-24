import { useState } from 'react'
import { Button } from './ui/button'
import { kickErrorEvidence } from '../engine/kick-error'
import { TABLE } from '../engine/constants'
import { POCKET_GEOMETRY } from '../engine/table-geometry'
import { distance } from '../engine/math'
import type { PreparedRound, RoundAnalysis, Vec2 } from '../engine/types'
const points = (path: Vec2[]) => path.map(p => `${p.x},${p.y}`).join(' ')
const legs = ['Launch → R1', 'R1 → R2', 'R2 → contact']
const events = ['R1', 'R2', 'Contact']
export default function KickErrorComparison({ prepared, result, hidden, busy }: { prepared: PreparedRound; result: RoundAnalysis | null; hidden: boolean; busy: boolean }) {
  const [prediction, setPrediction] = useState<number | null>(null), [retry, setRetry] = useState(false)
  const x = prepared.kickError!, option = prepared.balls[0].options.find(o => o.id === x.referenceId)!, e = kickErrorEvidence(prepared.scenario, option.plan, x)!
  const revealed = Boolean(result) && !retry, degrees = (x.radians * 180 / Math.PI).toFixed(3)
  const variants = [{ key: 'minus', color: '#7de3ef', label: `−${degrees}°`, data: e.minus, simulation: x.minus }, { key: 'plus', color: '#ff9f98', label: `+${degrees}°`, data: e.plus, simulation: x.plus }]
  const extent = Math.max(.025, ...variants.flatMap(v => v.data.positions.map((p, i) => distance(p, e.reference.positions[i]) * 1.3)))
  return <section className="lesson-comparison" aria-label="Kick angular-error comparison" hidden={hidden}>
    <h3>Where does the separation grow most?</h3>
    <p>Use reference finish {option.label}. Change only its launch aim by −{degrees}° and +{degrees}°; speed, draw/follow, English and all starting balls stay fixed. Which leg adds the most separation between the two paths?</p>
    <p>Track the same two strokes all the way through R1, R2 and first contact with ball 1. Both perturbations use the same two rails in the same order. Cyan is the negative aim change; pink is positive. The thin white line is the nominal reference.</p>
    <figure><figcaption><strong>Matched aim changes · Finish {option.label}</strong></figcaption>
      <svg viewBox="-.10 -.10 2.74 1.47" role="img" aria-label="Two perturbed kick approaches through the same ordered rebounds">
        <rect width="2.54" height="1.27" rx=".04" fill="#143f38" />
        {POCKET_GEOMETRY.map(p => <circle key={p.id} cx={p.center.x} cy={p.center.y} r=".045" fill="#071e1b" />)}
        {prepared.scenario.balls.map(b => <g key={b.id}><circle cx={b.position.x} cy={b.position.y} r={TABLE.ballRadius} fill={b.id === 0 ? '#fff' : b.id === 1 ? '#ffc16e' : '#9aa9a4'} fillOpacity={b.id > 1 ? .35 : 1} />{b.id === 1 && <text x={b.position.x} y={b.position.y + .014} textAnchor="middle" fontSize=".043" fill="#071e1b">1</text>}</g>)}
        <polyline points={points(e.reference.path)} fill="none" stroke="#fff" strokeWidth=".004" />
        {variants.map(v => <polyline key={v.key} data-testid={`error-path-${v.key}`} points={points(v.data.path)} fill="none" stroke={v.color} strokeWidth=".006" />)}
        {e.reference.positions.slice(0, 2).map((p, i) => <g key={i} transform={`translate(${p.x} ${p.y})`}><circle r=".06" fill="#071e1b" stroke="#fff" strokeWidth=".005" /><text y=".015" textAnchor="middle" fontSize=".043" fill="#fff">R{i + 1}</text></g>)}
      </svg>
    </figure>
    <div role="group" className="lesson-predictions" aria-label="Separation growth prediction">{legs.map((leg, i) => <Button key={leg} size="sm" variant={prediction === i ? 'default' : 'outline'} aria-pressed={prediction === i} disabled={busy || revealed} onClick={() => setPrediction(i)}>{leg}</Button>)}</div>
    {revealed && <>
      <p role="status"><strong>{prediction === null ? `${legs[e.largest]} adds the most separation.` : prediction === e.largest ? `Correct: ${legs[e.largest]} adds the most separation.` : `The largest increase is on ${legs[e.largest]}.`}</strong></p>
      <table className="kick-pace-speeds"><caption>Pair separation at matching events</caption><thead><tr><th scope="col">Event</th><th scope="col">Gap</th><th scope="col">Change</th></tr></thead><tbody>{events.map((event, i) => <tr key={event}><th scope="row">{event}</th><td data-testid={`error-spread-${i}`}>{(e.spreads[i] * 1000).toFixed(1)} mm</td><td data-testid={`error-growth-${i}`}>{e.growth[i] >= 0 ? '+' : ''}{(e.growth[i] * 1000).toFixed(1)} mm</td></tr>)}</tbody></table>
      <p>Gap is the straight-line distance between the two recorded cue-ball centers at that event. Change subtracts the previous event’s gap, starting from zero at launch. A negative change means convergence. The events happen at each stroke’s own time; these are not equal-time snapshots.</p>
      <figure><figcaption><strong>Enlarged event positions · One shared scale</strong></figcaption>
        <svg viewBox="0 0 3 1.15" role="img" aria-label="R1, R2 and contact separation at a shared magnified scale">
          <rect width="3" height="1.15" fill="#143f38" />
          {events.map((event, i) => <g key={event}>
            <text x={i + .5} y=".13" textAnchor="middle" fontSize=".12" fill="#fff">{event}</text>
            <g transform={`translate(${i + .5} .65) scale(${.38 / extent})`}>
              <line x1={-extent} x2={extent} y1="0" y2="0" stroke="#888" strokeWidth={extent * .012} /><line x1="0" x2="0" y1={-extent} y2={extent} stroke="#888" strokeWidth={extent * .012} />
              <polyline points={points(variants.map(v => ({ x: v.data.positions[i].x - e.reference.positions[i].x, y: v.data.positions[i].y - e.reference.positions[i].y })))} fill="none" stroke="#fff" strokeWidth={extent * .025} />
              <circle r={extent * .045} fill="#fff" />
              {variants.map(v => <circle key={v.key} data-testid={`error-inset-${v.key}-${i}`} cx={v.data.positions[i].x - e.reference.positions[i].x} cy={v.data.positions[i].y - e.reference.positions[i].y} r={extent * .07} fill={v.color} />)}
            </g>
          </g>)}
        </svg>
      </figure>
      <p>Each inset centers its own nominal event on the white dot; all three use the same magnification. Colored dots are actual event positions, and the white connector measures their gap. They are point markers, not ball-size drawings.</p>
      <p>In this example, {legs[e.largest]} adds {(e.growth[e.largest] * 1000).toFixed(1)} mm. The result belongs to this layout, pace, spin and aim offset; separation need not grow at every rebound. This measures accumulated spatial separation, not an isolated cushion effect.</p>
      <ul>{variants.map(v => <li key={v.key}>{v.label}: ball 1 contacted after two cushions; {v.simulation.potted.includes(1) ? 'ball 1 potted' : 'ball 1 not potted'}; {v.simulation.scratch ? 'scratch' : 'no scratch'}.</li>)}</ul>
      <p>{result?.selected.plan.id === option.id ? `You chose reference finish ${option.label}.` : `You chose another finish; this comparison uses finish ${option.label}.`} These two unscored aim changes are not a probability estimate. Compare the regular trial results to judge the reliability of complete strokes.</p>
      <Button size="sm" variant="outline" onClick={() => { setRetry(true); setPrediction(null) }}>Try the prediction again</Button>
    </>}
    {result && retry && <Button size="sm" onClick={() => setRetry(false)}>Check prediction</Button>}
    <p className="lesson-comparison-note">This prediction is optional and never blocks advancement.</p>
  </section>
}
