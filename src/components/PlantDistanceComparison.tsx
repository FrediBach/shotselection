import { useState } from 'react'
import { Button } from './ui/button'
import { plantDistanceEvidence } from '../engine/plant-distance'
import { TABLE } from '../engine/constants'
import { CUSHIONS, POCKET_GEOMETRY } from '../engine/table-geometry'
import type { PreparedRound, RoundAnalysis, Vec2 } from '../engine/types'
const points = (p: Vec2[]) => p.map(v => `${v.x},${v.y}`).join(' ')
export default function PlantDistanceComparison({ prepared, result, hidden, busy }: { prepared: PreparedRound; result: RoundAnalysis | null; hidden: boolean; busy: boolean }) {
  const [prediction, setPrediction] = useState<string | null>(null), [retry, setRetry] = useState(false), [detail, setDetail] = useState(false)
  const x = prepared.plantDistance!, option = prepared.balls.find(b => b.ballId === 1)!.options.find(o => o.id === x.referenceId)!
  const e = plantDistanceEvidence(prepared.scenario, option.plan, x)!, revealed = Boolean(result) && !retry
  const mouth = e.geometry.pocket.mouthCenter
  return <section className="lesson-comparison" aria-label="Plant target-distance comparison" hidden={hidden}>
    <h3>The distance after the transfer</h3>
    <p>Compare the authored long run with a shorter reference to the same corner pocket. With the same change in ball 2’s outgoing direction, which run produces more lateral deviation by the pocket mouth?</p>
    <div role="group" className="lesson-predictions" aria-label="Target-distance prediction">{['Short run', 'Long run'].map(answer => <Button key={answer} size="sm" variant={prediction === answer ? 'default' : 'outline'} aria-pressed={prediction === answer} disabled={busy || revealed} onClick={() => setPrediction(answer)}>{answer}</Button>)}</div>
    {revealed && <>
      <p role="status"><strong>{prediction === 'Long run' ? 'Correct: the longer run produces more lateral deviation.' : 'The longer run produces more lateral deviation.'}</strong></p>
      <p>The short reference moves the cue and pair {(Math.hypot(e.shift.x, e.shift.y) * 100).toFixed(1)} cm together toward the pocket along the initial pair line. Cue approach, cut and transfer gap stay fixed, as do pocket type, pair-line entry and stroke speed/spin. Free ball 3 stays fixed.</p>
      <p>Plant finish {option.label} pots ball 2 in both layouts at the original aim. Apply {x.degrees > 0 ? '+' : ''}{x.degrees.toFixed(2)}° to the cue’s aim in both: ball 2’s measured initial direction changes by {e.angle.toFixed(2)}° in each. The short run still pots; the long run reaches the pocket area, contacts a jaw or cushion and misses.</p>
      <table><caption>Initial target rays projected to the mouth</caption><thead><tr><th>Run</th><th>Distance</th><th>Deviation</th></tr></thead><tbody>
        <tr><th>Short</th><td>{(e.shortNominal.travel * 100).toFixed(1)} cm</td><td>{(e.shortDrift * 1000).toFixed(1)} mm</td></tr>
        <tr><th>Long</th><td>{(e.longNominal.travel * 100).toFixed(1)} cm</td><td>{(e.longDrift * 1000).toFixed(1)} mm</td></tr>
      </tbody></table>
      <p>Distance follows the original target ray to the mouth line. Deviation is the separation between original and changed ray crossings, measured along that line. These are geometric projections of recorded initial directions, before later jaw or cushion effects; they are not measured rebound distances.</p>
      <div role="group" className="lesson-predictions" aria-label="Inspect target travel"><Button size="sm" variant={!detail ? 'default' : 'outline'} aria-pressed={!detail} onClick={() => setDetail(false)}>Full routes</Button><Button size="sm" variant={detail ? 'default' : 'outline'} aria-pressed={detail} onClick={() => setDetail(true)}>Pocket detail</Button></div>
      {([true, false] as const).map(short => {
        const scenario = short ? e.short : prepared.scenario, id = short ? 'short' : 'long'
        const nominal = short ? x.shortNominal : x.longNominal, changed = short ? x.shortChanged : x.longChanged
        const a = short ? e.shortNominal : e.longNominal, b = short ? e.shortChanged : e.longChanged
        const target = scenario.balls.find(ball => ball.id === 2)!.position
        return <figure key={id}><figcaption><strong>{short ? 'Short reference · Changed aim pots' : 'Long authored run · Changed aim misses'}</strong></figcaption>
          <svg viewBox={detail ? `${mouth.x - .18} ${mouth.y - .18} .36 .36` : '-.08 -.08 2.70 1.43'} role="img" aria-label={`${short ? 'Short' : 'Long'} run: original and changed target paths`}>
            <rect x="-.2" y="-.2" width="2.94" height="1.67" fill="#0b241f" /><rect width="2.54" height="1.27" fill="#143f38" />
            {CUSHIONS.map(c => <polygon key={c.id} points={points(c.polygon)} fill="#205247" stroke="#8aa99f" strokeWidth=".002" />)}
            {POCKET_GEOMETRY.map(p => <circle key={p.id} cx={p.center.x} cy={p.center.y} r={p.radius} fill="#061713" />)}
            <polyline data-testid={`${id}-nominal-path`} points={points(nominal.objectPath)} fill="none" stroke="#fff" strokeWidth={detail ? '.003' : '.006'} />
            <polyline data-testid={`${id}-changed-path`} points={points(changed.objectPath)} fill="none" stroke="#ffc16e" strokeWidth={detail ? '.003' : '.006'} />
            <polyline points={points(e.geometry.pocket.mouth)} fill="none" stroke="#7de3bf" strokeWidth=".004" />
            <polyline data-testid={`${id}-nominal-ray`} points={points([target, a.hit])} fill="none" stroke="#fff" strokeWidth=".002" strokeDasharray=".008 .006" />
            <polyline data-testid={`${id}-changed-ray`} points={points([target, b.hit])} fill="none" stroke="#ffc16e" strokeWidth=".002" strokeDasharray=".008 .006" />
            <polyline data-testid={`${id}-deviation`} points={points([a.hit, b.hit])} fill="none" stroke="#ff9f98" strokeWidth=".005" />
            {[a.hit, b.hit].map((p, i) => <circle key={i} cx={p.x} cy={p.y} r=".004" fill="#ff9f98" />)}
            {scenario.balls.map(ball => <g key={ball.id}><circle cx={ball.position.x} cy={ball.position.y} r={TABLE.ballRadius} fill={ball.id === 0 ? '#fff' : ball.id === 1 ? '#7de3ef' : ball.id === 2 ? '#ffc16e' : '#9aa9a4'} /><text x={ball.position.x} y={ball.position.y + .009} textAnchor="middle" fontSize=".026" fill="#071e1b">{ball.id || ''}</text></g>)}
          </svg>
        </figure>
      })}
      <p>White = original aim; gold = changed aim. Solid lines are actual ball-2 paths, including later rebounds; dashes extend initial directions. Pink joins their projected crossings on the green mouth line. Both views use the same scale. Filled balls mark starting positions.</p>
      <p>The paired simulations preserve cue → 1 → 2, contact times and incoming velocities, with no later contact involving either plant ball. Later cue/free-ball contacts may differ and are excluded from this target-path comparison. The target’s initial direction matches between layouts for each aim. Throw can shift the nominal ray away from the initial pair line; the two nominal ray crossings need not coincide.</p>
      <p>{result?.selected.plan.id === option.id ? `You chose reference plant finish ${option.label}.` : `You chose another stroke; this comparison uses plant finish ${option.label}.`} This isolates target travel, independently of cue-ball finish or scratch. It is one matched example, not a success probability; use the regular trials for complete-stroke reliability.</p>
      <Button size="sm" variant="outline" onClick={() => { setRetry(true); setPrediction(null); setDetail(false) }}>Try the prediction again</Button>
    </>}
    {result && retry && <Button size="sm" onClick={() => setRetry(false)}>Check prediction</Button>}
    <p className="lesson-comparison-note">This prediction is optional and never blocks advancement.</p>
  </section>
}
