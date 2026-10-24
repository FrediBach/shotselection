import { useId, useMemo, useState } from 'react'
import { Button } from './ui/button'
import { englishRoutingFinder } from '../engine/english-routing'
import { TABLE } from '../engine/constants'
import { POCKET_GEOMETRY } from '../engine/table-geometry'
import type { PreparedRound, RoundAnalysis, Vec2 } from '../engine/types'

const points = (path: Vec2[]) => path.map(p => `${p.x},${p.y}`).join(' ')
export default function EnglishRoutingComparison({ prepared, result, hidden, busy }: { prepared: PreparedRound; result: RoundAnalysis | null; hidden: boolean; busy: boolean }) {
  const [prediction, setPrediction] = useState<string | null>(null), [retry, setRetry] = useState(false)
  const marker = useId(), referenceId = prepared.englishRouting!.referenceId
  const option = prepared.balls[0].options.find(o => o.id === referenceId)!
  const evidence = useMemo(() => result ? englishRoutingFinder(prepared.scenario)(result.candidates.filter(s => s.plan.id === referenceId).map(s => ({ plan: s.plan, simulation: s.nominal }))) : null, [prepared, result, referenceId])
  const revealed = Boolean(result) && !retry
  const zone = prepared.scenario.objective!
  return <section className="lesson-comparison" aria-label="English routing comparison" hidden={hidden}>
    <h3>Change the route with English</h3>
    <p>Use stroke {option.label} as the reference. Remove only its English, keeping aim, pace, draw or follow and every starting ball fixed. Will the two routes pass ball 3 on the same side or opposite sides after the cushion?</p>
    <div className="lesson-predictions" role="group" aria-label="English routing prediction">{['Same side', 'Opposite sides'].map(answer => <Button key={answer} size="sm" variant={prediction === answer ? 'default' : 'outline'} aria-pressed={prediction === answer} disabled={busy || revealed} onClick={() => setPrediction(answer)}>{answer}</Button>)}</div>
    {revealed && evidence && <>
      <p role="status"><strong>{prediction === null ? 'Compare the two routes after the cushion.' : prediction === 'Opposite sides' ? 'Correct: English changes which side of ball 3 the cue passes.' : 'The routes pass on opposite sides of ball 3.'}</strong></p>
      <p>Both versions legally pot ball 1 into the same pocket, avoid every spare ball and finish inside the same {(zone.radius * 100).toFixed(1)} cm-radius zone with a proven next shot on ball 2. Every remaining object ball stays in place.</p>
      {[{ key: 'english', title: `Stroke ${option.label} · With English`, e: evidence.withEnglish, color: '#7de3ef' }, { key: 'control', title: 'Controlled comparison · No English', e: evidence.withoutEnglish, color: '#ff9f98' }].map(({ key, title, e, color }) => <figure key={key}>
        <figcaption><strong>{title}</strong></figcaption>
        <svg viewBox="-.08 -.08 2.70 1.43" role="img" aria-label={`${title}: route around ball 3`}>
          <defs><marker id={`${marker}-${key}`} markerWidth="4" markerHeight="4" refX="3" refY="2" orient="auto"><path d="M0,0 L4,2 L0,4 Z" fill={color} /></marker></defs>
          <rect width="2.54" height="1.27" rx=".04" fill="#143f38" />
          {POCKET_GEOMETRY.map(p => <circle key={p.id} cx={p.center.x} cy={p.center.y} r=".045" fill="#071e1b" />)}
          <circle cx={zone.target!.x} cy={zone.target!.y} r={zone.radius} fill="#7de3ef" fillOpacity=".1" stroke="#7de3ef" strokeWidth=".005" strokeDasharray=".025 .02" />
          <polyline points={points(e.simulation.objectPath)} fill="none" stroke="#ffc16e" strokeWidth=".008" />
          <polyline points={points(e.before)} fill="none" stroke="#c8cfcc" strokeWidth=".009" strokeDasharray=".025 .02" />
          <polyline points={points(e.after)} fill="none" stroke={color} strokeWidth={TABLE.ballDiameter} strokeOpacity=".2" />
          <polyline points={points(e.after)} fill="none" stroke={color} strokeWidth=".009" markerEnd={`url(#${marker}-${key})`} />
          <circle cx={e.rebound.position.x} cy={e.rebound.position.y} r=".04" fill="none" stroke="#fff" strokeWidth=".006" />
          <circle cx={e.simulation.cueEnd.x} cy={e.simulation.cueEnd.y} r={TABLE.ballRadius} fill="none" stroke={color} strokeWidth=".006" />
          {prepared.scenario.balls.map(b => <g key={b.id}><circle cx={b.position.x} cy={b.position.y} r={TABLE.ballRadius} fill={b.id === 0 ? '#fff' : b.id === 3 ? '#ff9f98' : '#ffc16e'} /><text x={b.position.x} y={b.position.y + .014} textAnchor="middle" fontSize=".043" fill="#071e1b">{b.id || ''}</text></g>)}
        </svg>
        <dl className="geometry-measures"><div><dt>Post-rebound clearance beside ball 3</dt><dd>{(e.clearance * 1000).toFixed(1)} mm</dd></div></dl>
      </figure>)}
      <p>White rings mark the rebound points. Grey dashes show the earlier cue paths; coloured ball-width bands and arrows show the routes after the cushion. The small coloured rings mark the finishes inside the shared zone. Gold shows ball 1’s pot; balls are drawn at their starting positions.</p>
      <dl className="geometry-measures"><div><dt>Rebound-point separation</dt><dd>{(evidence.reboundSeparation * 1000).toFixed(1)} mm</dd></div><div><dt>Incoming direction difference</dt><dd>{evidence.incomingDifference.toFixed(1)}°</dd></div><div><dt>Outgoing direction difference</dt><dd>{evidence.outgoingDifference.toFixed(1)}°</dd></div></dl>
      <h4>Opposite sides of the same blocker</h4>
      <svg viewBox={`${evidence.blocker.position.x - .23} ${evidence.blocker.position.y - .23} .46 .46`} role="img" aria-label="Enlarged English and no-English paths around ball 3">
        <rect width="2.54" height="1.27" fill="#143f38" />
        {[{e:evidence.withEnglish, color:'#7de3ef'}, {e:evidence.withoutEnglish, color:'#ff9f98'}].map(({e,color}) => <g key={color}><polyline points={points(e.after)} fill="none" stroke={color} strokeWidth={TABLE.ballDiameter} strokeOpacity=".25" /><polyline points={points(e.after)} fill="none" stroke={color} strokeWidth=".003" /><circle cx={e.nearest.point.x} cy={e.nearest.point.y} r={TABLE.ballRadius} fill="none" stroke={color} strokeWidth=".002" /></g>)}
        <circle cx={evidence.blocker.position.x} cy={evidence.blocker.position.y} r={TABLE.ballRadius} fill="#ffc16e" /><text x={evidence.blocker.position.x} y={evidence.blocker.position.y + .008} textAnchor="middle" fontSize=".026" fill="#071e1b">3</text>
      </svg>
      <p>Cyan is the English route; pink is the no-English control. English changes the cushion departure enough to open a route past the other side of ball 3 while preserving the finish. Both routes are clear nominally; this does not establish which is more reliable under stroke errors.</p>
      <p>Your selected stroke {result!.selected.plan.id === referenceId ? 'is the English reference.' : 'is another offered stroke; the experiment above uses the named English reference.'}</p>
      <p className="lesson-comparison-note">The no-English control is a separate diagnostic, not one of the three offered strokes or an extra scored attempt. Regular scoring is unchanged.</p>
      <Button size="sm" variant="outline" onClick={() => { setRetry(true); setPrediction(null) }}>Try the prediction again</Button>
    </>}
    {revealed && !evidence && <p role="status">The English routing comparison could not be verified for this result.</p>}
    {result && retry && <Button size="sm" onClick={() => setRetry(false)}>Check prediction</Button>}
    <p className="lesson-comparison-note">This prediction is optional and never blocks advancement.</p>
  </section>
}
