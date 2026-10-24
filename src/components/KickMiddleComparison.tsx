import { useState } from 'react'
import { Button } from './ui/button'
import { kickMiddleEvidence, withoutMiddleBlocker } from '../engine/kick-middle'
import { TABLE } from '../engine/constants'
import { POCKET_GEOMETRY } from '../engine/table-geometry'
import type { PreparedRound, RoundAnalysis, Scenario, Vec2 } from '../engine/types'
const points = (p: Vec2[]) => p.map(v => `${v.x},${v.y}`).join(' ')
const colors = ['#fff', '#7de3ef', '#ffc16e']
function Diagram({ source, legs, rebounds, id, label, ghost, contact, objectPath, pocketId }: { source: Scenario; legs: Vec2[][]; rebounds: Vec2[]; id: string; label: string; ghost?: Vec2[][]; contact?: Vec2; objectPath?: Vec2[]; pocketId: number }) {
  return <svg viewBox="-.10 -.10 2.74 1.47" role="img" aria-label={label}>
    <rect width="2.54" height="1.27" rx=".04" fill="#143f38" />
    {POCKET_GEOMETRY.map(p => <circle key={p.id} cx={p.center.x} cy={p.center.y} r=".045" fill="#071e1b" stroke={p.id === pocketId ? '#ffc16e' : 'none'} strokeWidth=".008" />)}
    {ghost?.map((leg, i) => <polyline key={i} points={points(leg)} fill="none" stroke="#bbb" strokeWidth=".006" strokeDasharray=".02 .015" />)}
    {legs.map((leg, i) => <g key={i}><polyline points={points(leg)} fill="none" stroke={contact && i === 1 ? '#ff9f98' : colors[i]} strokeWidth={TABLE.ballDiameter} strokeOpacity=".18" /><polyline data-testid={`${id}-leg-${i + 1}`} points={points(leg)} fill="none" stroke={contact && i === 1 ? '#ff9f98' : colors[i]} strokeWidth=".008" /></g>)}
    {objectPath && <polyline data-testid={`${id}-pot`} points={points(objectPath)} fill="none" stroke="#ffc16e" strokeWidth=".007" strokeDasharray=".015 .01" />}
    {source.balls.map(b => <g key={b.id} data-testid={`${id}-ball-${b.id}`}><circle cx={b.position.x} cy={b.position.y} r={TABLE.ballRadius} fill={b.id === 0 ? '#fff' : b.id === 1 ? '#ffc16e' : b.id === 10 ? '#ff9f98' : '#9aa9a4'} fillOpacity={b.id > 1 && b.id !== 10 ? .4 : 1} />{(b.id === 1 || b.id === 10) && <text x={b.position.x} y={b.position.y + .012} textAnchor="middle" fontSize=".035" fill="#071e1b">{b.id}</text>}</g>)}
    {rebounds.map((r, i) => <g key={i} transform={`translate(${r.x} ${r.y})`}><circle r=".06" fill="#071e1b" stroke="#fff" strokeWidth=".006" strokeDasharray={contact && i === 1 ? '.01 .01' : undefined} /><text y=".015" textAnchor="middle" fontSize=".042" fill="#fff">R{i + 1}{contact && i === 1 ? '*' : ''}</text></g>)}
    {contact && <circle data-testid={`${id}-contact`} cx={contact.x} cy={contact.y} r={TABLE.ballRadius} fill="none" stroke="#fff" strokeWidth=".007" />}
  </svg>
}
export default function KickMiddleComparison({ prepared, result, hidden, busy }: { prepared: PreparedRound; result: RoundAnalysis | null; hidden: boolean; busy: boolean }) {
  const [prediction, setPrediction] = useState<number | null>(null), [retry, setRetry] = useState(false), [removal, setRemoval] = useState(false)
  const x = prepared.kickMiddle!, option = prepared.balls[0].options.find(o => o.id === x.referenceId)!
  const e = kickMiddleEvidence(prepared.scenario, option.plan, x)!, revealed = Boolean(result) && !retry
  const clear = prepared.scenario.seed % 2 ? 1 : 2, blocked = 3 - clear, blocker = prepared.scenario.balls.find(b => b.id === 10)!
  return <section className="lesson-comparison" aria-label="Middle-leg comparison" hidden={hidden}>
    <h3>Inspect the leg between rebounds</h3>
    <p>Which route clears ball 10 between R1 and R2 and reaches ball 1?</p>
    <p>These previews simulate each stroke with only ball 10 removed, then overlay it at its real position. White is the first leg, cyan the middle leg, and gold the final approach. Bands show the cue ball’s full width. Both routes target the same pocket.</p>
    <div role="group" className="lesson-predictions" aria-label="Middle-leg prediction">{[1, 2].map(n => <Button key={n} size="sm" variant={prediction === n ? 'default' : 'outline'} aria-pressed={prediction === n} disabled={busy || revealed} onClick={() => setPrediction(n)}>Route {n}</Button>)}</div>
    {revealed && <p role="status"><strong>{prediction === null ? `Route ${clear} clears the middle leg.` : prediction === clear ? `Correct: route ${clear} clears the middle leg.` : `Route ${blocked} hits ball 10 before R2.`}</strong></p>}
    {[1, 2].map(n => {
      const safe = n === clear, route = safe ? e.referenceOpen : e.intended, failed = revealed && !safe
      return <figure key={n}><figcaption><strong>Route {n}{revealed ? safe ? ` · Reference finish ${option.label}` : ' · Middle leg blocked' : ''}</strong></figcaption>
        <Diagram source={prepared.scenario} legs={failed ? e.blockedLegs : route.legs} rebounds={[route.first.position, route.second.position]} id={`middle-route-${n}`} label={`Route ${n}: ${revealed ? 'actual outcome' : 'three-leg preview'}`} pocketId={option.plan.pocketId} ghost={failed ? route.legs.slice(1) : undefined} contact={failed ? e.contact.position : undefined} objectPath={revealed && safe ? x.reference.objectPath : undefined} />
        {revealed && <p>{safe ? `The reference clears ball 10 on all three legs; its middle-leg surface clearance is ${(e.clearGaps[1] * 1000).toFixed(1)} mm. It contacts ball 1 first and pots it without scratching.` : `The intended first and final legs clear ball 10 by ${(e.gaps[0] * 1000).toFixed(1)} and ${(e.gaps[2] * 1000).toFixed(1)} mm. The middle corridor overlaps it. Actual first contact is ball 10 at ${e.contact.time.toFixed(2)} s, after R1 at ${e.rebound.time.toFixed(2)} s and before the intended R2.`}</p>}
      </figure>
    })}
    {revealed && <>
      <p>Red ends at the actual collision. R2* and grey dashes belong to the removal preview; the blocked approach never reaches that second rebound before object contact. Later collision motion is omitted.</p>
      <figure><figcaption><strong>Middle-leg contact with ball 10</strong></figcaption>
        <svg viewBox={`${blocker.position.x - .18} ${blocker.position.y - .18} .36 .36`} role="img" aria-label="Enlarged actual collision between rebounds">
          <rect x={blocker.position.x - .18} y={blocker.position.y - .18} width=".36" height=".36" fill="#143f38" />
          <polyline points={points(e.intended.legs[1])} fill="none" stroke="#bbb" strokeWidth=".002" strokeDasharray=".008 .006" />
          <polyline data-testid="middle-contact-path" points={points(e.blockedLegs[1])} fill="none" stroke="#ff9f98" strokeWidth=".003" />
          <circle cx={blocker.position.x} cy={blocker.position.y} r={TABLE.ballRadius} fill="#ff9f98" /><text x={blocker.position.x} y={blocker.position.y + .007} textAnchor="middle" fontSize=".02" fill="#071e1b">10</text>
          <circle data-testid="middle-contact-center" cx={e.contact.position.x} cy={e.contact.position.y} r={TABLE.ballRadius} fill="none" stroke="#fff" strokeWidth=".002" />
        </svg>
      </figure>
      <Button size="sm" variant="outline" onClick={() => setRemoval(v => !v)}>{removal ? 'Hide' : 'Show'} route {blocked} without ball 10</Button>
      {removal && <figure><figcaption><strong>Fixed-stroke removal test · Only ball 10 removed</strong></figcaption>
        <Diagram source={withoutMiddleBlocker(prepared.scenario)} legs={e.intended.legs} rebounds={[e.intended.first.position, e.intended.second.position]} id="middle-removal" label="Removal test: same stroke completes both rebounds and pots ball 1" pocketId={option.plan.pocketId} objectPath={x.intended.objectPath} />
        <p>Aim, speed, draw/follow, English and every remaining ball stay unchanged. The same stroke now reaches R2 at {e.intended.second.time.toFixed(2)} s, contacts ball 1 first and pots it without scratching.</p>
      </figure>}
      <p>{result?.selected.plan.id === option.id ? `You chose reference finish ${option.label}.` : `You chose another finish; the clear reference is finish ${option.label}.`} The blocked candidate and removal test are unscored. The three offered choices remain playable. Nominal clearance does not measure collision probability.</p>
      <Button size="sm" variant="outline" onClick={() => { setRetry(true); setPrediction(null); setRemoval(false) }}>Try the prediction again</Button>
    </>}
    {result && retry && <Button size="sm" onClick={() => setRetry(false)}>Check prediction</Button>}
    <p className="lesson-comparison-note">This prediction is optional and never blocks advancement.</p>
  </section>
}
