import { useId, useMemo, useState } from 'react'
import { Button } from './ui/button'
import { elongatedPositionFinder } from '../engine/elongated-position'
import { TABLE } from '../engine/constants'
import { POCKET_GEOMETRY } from '../engine/table-geometry'
import type { PositionObjective, PreparedRound, RoundAnalysis, Vec2 } from '../engine/types'

const points = (path: Vec2[]) => path.map(p => `${p.x},${p.y}`).join(' ')
const signed = (n: number) => `${n > 0 ? '+' : ''}${n}%`
function Region({ zone }: { zone: PositionObjective }) {
  return <g transform={`translate(${zone.target!.x} ${zone.target!.y}) rotate(${zone.ellipse!.angle * 180 / Math.PI})`}>
    <ellipse rx={zone.ellipse!.longRadius} ry={zone.radius} fill="#7de3ef" fillOpacity=".12" stroke="#7de3ef" strokeWidth=".006" />
    <line x1={-zone.ellipse!.longRadius} x2={zone.ellipse!.longRadius} stroke="#7de3ef" strokeWidth=".003" strokeDasharray=".02 .02" />
  </g>
}
export default function ElongatedPositionComparison({ prepared, result, hidden, busy }: { prepared: PreparedRound; result: RoundAnalysis | null; hidden: boolean; busy: boolean }) {
  const [prediction, setPrediction] = useState<string | null>(null), [retry, setRetry] = useState(false), [probes, setProbes] = useState<string | null>(null)
  const marker = useId(), contrast = prepared.elongatedPosition!
  const options = prepared.balls[0].options.filter(o => [contrast.alongId, contrast.acrossId].includes(o.id))
  const pair = useMemo(() => result ? elongatedPositionFinder(prepared.scenario)(result.candidates.filter(s => [contrast.alongId, contrast.acrossId].includes(s.plan.id)).map(s => ({ plan: s.plan, simulation: s.nominal }))) : null, [prepared, result, contrast])
  const revealed = Boolean(result) && !retry, zone = prepared.scenario.objective!
  return <section className="lesson-comparison" aria-label="Elongated position comparison" hidden={hidden}>
    <h3>Enter along the window</h3>
    <p>The shared target is an ellipse, {(zone.ellipse!.longRadius * 200).toFixed(1)} cm long and {(zone.radius * 200).toFixed(1)} cm wide. Strokes {options.map(o => o.label).join(' and ')} both finish inside it with ball 2 available. Which arrival gives a wider useful speed range?</p>
    <div className="lesson-predictions" role="group" aria-label="Elongated position prediction">{options.map(o => <Button key={o.id} size="sm" variant={prediction === o.id ? 'default' : 'outline'} aria-pressed={prediction === o.id} disabled={busy || revealed} onClick={() => setPrediction(o.id)}>Stroke {o.label}</Button>)}</div>
    {revealed && pair && <>
      <p role="status"><strong>{prediction === null ? 'Compare entering along the length with crossing the width.' : prediction === contrast.alongId ? 'Your prediction has the wider tested speed range.' : 'The entry along the long direction has the wider tested range.'}</strong></p>
      <p>Both nominal openers legally pot ball 1, avoid moving the spare balls and retain a proven next pot. The entry angle is measured where the actual cue path last crosses into the ellipse, relative to its long axis.</p>
      {options.map(o => {
        const along = o.id === contrast.alongId, e = along ? pair.a : pair.b, entry = along ? pair.alongEntry : pair.acrossEntry, sweep = along ? pair.alongSweep : pair.acrossSweep, color = along ? '#7de3ef' : '#ff9f98'
        return <figure key={o.id}>
          <figcaption><strong>Stroke {o.label} · {along ? 'Along the length' : 'Across the width'}</strong></figcaption>
          <svg viewBox="-.08 -.08 2.70 1.43" role="img" aria-label={`Stroke ${o.label}: ${along ? 'along' : 'across'} entry into ellipse`}>
            <defs><marker id={`${marker}-${o.label}`} markerWidth="4" markerHeight="4" refX="3" refY="2" orient="auto"><path d="M0,0 L4,2 L0,4 Z" fill={color} /></marker></defs>
            <rect width="2.54" height="1.27" rx=".04" fill="#143f38" />
            {POCKET_GEOMETRY.map(p => <circle key={p.id} cx={p.center.x} cy={p.center.y} r=".045" fill="#071e1b" />)}
            <Region zone={zone} />
            <polyline points={points(e.traced.objectPath)} fill="none" stroke="#ffc16e" strokeWidth=".008" />
            <polyline points={points(e.traced.cuePath)} fill="none" stroke={color} strokeWidth=".009" />
            <line x1={entry.point.x - entry.direction.x * .07} y1={entry.point.y - entry.direction.y * .07} x2={entry.point.x + entry.direction.x * .07} y2={entry.point.y + entry.direction.y * .07} stroke={color} strokeWidth=".01" markerEnd={`url(#${marker}-${o.label})`} />
            <circle cx={entry.point.x} cy={entry.point.y} r=".026" fill="none" stroke="#fff" strokeWidth=".005" />
            <circle cx={e.traced.cueEnd.x} cy={e.traced.cueEnd.y} r={TABLE.ballRadius} fill="none" stroke={color} strokeWidth=".006" />
            {prepared.scenario.balls.map(b => <g key={b.id}><circle cx={b.position.x} cy={b.position.y} r={TABLE.ballRadius} fill={b.id === 0 ? '#fff' : '#ffc16e'} /><text x={b.position.x} y={b.position.y + .014} textAnchor="middle" fontSize=".043" fill="#071e1b">{b.id || ''}</text></g>)}
          </svg>
          <dl className="geometry-measures"><div><dt>Entry angle to the long axis</dt><dd>{(along ? pair.alongAngle : pair.acrossAngle).toFixed(1)}°</dd></div><div><dt>Contiguous tested success range</dt><dd>{signed(sweep.low)} to {signed(sweep.high)}</dd></div></dl>
          <Button size="sm" variant="outline" aria-expanded={probes === o.id} onClick={() => setProbes(probes === o.id ? null : o.id)}>{probes === o.id ? `Hide stroke ${o.label} speed probes` : `Show stroke ${o.label} speed probes`}</Button>
          {probes === o.id && <>
            <svg viewBox={`${zone.target!.x - .43} ${zone.target!.y - .43} .86 .86`} role="img" aria-label={`Stroke ${o.label}: speed-only finishing positions`}>
              <rect width="2.54" height="1.27" fill="#143f38" /><Region zone={zone} />
              {sweep.trials.filter(t => !t.simulation.scratch && t.simulation.stopped).map(t => <circle key={t.percent} cx={t.simulation.cueEnd.x} cy={t.simulation.cueEnd.y} r={t.percent === 0 ? '.016' : '.009'} fill={t.success ? '#9fe7b7' : '#ff9f98'} stroke={t.percent === 0 ? '#fff' : 'none'} strokeWidth=".003"><title>{signed(t.percent)} speed: {t.success ? 'complete success' : 'failed'}</title></circle>)}
            </svg>
            <p>Green dots meet all three conditions; pink dots fail at least one. The white outline marks nominal pace. Only settled, unscratched finishes inside this close-up are visible; the table includes every probe.</p>
            <table className="speed-probes"><caption>Stroke {o.label}: speed-only probes</caption><thead><tr><th scope="col">Speed</th><th scope="col">Pot</th><th scope="col">Region</th><th scope="col">Next</th><th scope="col">All</th></tr></thead><tbody>{sweep.trials.map(t => <tr key={t.percent} data-success={t.success}><th scope="row">{signed(t.percent)}</th>{[t.legalPot,t.positioned,t.nextShotAvailable,t.success].map((v,i) => <td key={i}>{v ? 'Yes' : 'No'}</td>)}</tr>)}</tbody></table>
          </>}
        </figure>
      })}
      <p>The white entry rings and arrows mark the arrival directions; the dashed line is the ellipse’s long axis. Coloured paths show the cue and gold shows ball 1. Balls are drawn at their starting positions.</p>
      <p>Each sweep changes speed from −20% to +20% in 2% steps, keeping that stroke’s aim, draw or follow, and English fixed. “Pot” checks the legal opening pot without a scratch; “Region” checks the actual elliptical boundary; “Next” checks clear next-shot geometry within {zone.maxCutAngle}°. The probes do not execute the next pot.</p>
      <p>The range includes only consecutive successful tested settings connected to nominal pace. Untested values may fail, and reaching the ±20% limit does not establish the true boundary. These probes measure speed sensitivity, not a success probability or the combined effect of aiming and spin errors. The two offered strokes use different controls.</p>
      <p>Your selected stroke {result!.selected.plan.id === contrast.alongId ? 'is the along-length reference.' : result!.selected.plan.id === contrast.acrossId ? 'is the across-width reference.' : 'is the third alternative; the comparison uses the other two strokes.'}</p>
      <Button size="sm" variant="outline" onClick={() => { setRetry(true); setPrediction(null); setProbes(null) }}>Try the prediction again</Button>
    </>}
    {revealed && !pair && <p role="status">The elongated-region comparison could not be verified for this result.</p>}
    {result && retry && <Button size="sm" onClick={() => setRetry(false)}>Check prediction</Button>}
    <p className="lesson-comparison-note">This prediction is optional and never blocks advancement. The elliptical target is also used by regular scoring and tolerance analysis.</p>
  </section>
}
