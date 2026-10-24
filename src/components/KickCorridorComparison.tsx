import { useState } from 'react'
import { Button } from './ui/button'
import { kickCorridorEvidence, withoutKickBlocker } from '../engine/kick-corridor'
import { TABLE } from '../engine/constants'
import { POCKET_GEOMETRY } from '../engine/table-geometry'
import type { PreparedRound, RoundAnalysis, Scenario, Vec2 } from '../engine/types'

const points = (path: Vec2[]) => path.map(p => `${p.x},${p.y}`).join(' ')
function RouteDiagram({ source, incoming, outgoing, rebound, label, id, ghost, objectPath, contact, pocketId }: { source: Scenario; incoming: Vec2[]; outgoing: Vec2[]; rebound: Vec2; label: string; id: string; ghost?: Vec2[]; objectPath?: Vec2[]; contact?: Vec2; pocketId: number }) {
  return <svg viewBox="-.08 -.08 2.70 1.43" role="img" aria-label={label}>
    <rect width="2.54" height="1.27" rx=".04" fill="#143f38" />
    {POCKET_GEOMETRY.map(p => <circle key={p.id} cx={p.center.x} cy={p.center.y} r=".045" fill="#071e1b" stroke={p.id === pocketId ? '#ffc16e' : 'none'} strokeWidth=".008" />)}
    {ghost && <polyline points={points(ghost)} fill="none" stroke="#ccc" strokeWidth=".008" strokeDasharray=".025 .02" />}
    <polyline points={points(incoming)} fill="none" stroke="#fff" strokeWidth={TABLE.ballDiameter} strokeOpacity=".15" />
    <polyline points={points(outgoing)} fill="none" stroke={contact ? '#ff9f98' : '#7de3ef'} strokeWidth={TABLE.ballDiameter} strokeOpacity=".2" />
    <polyline data-testid={`${id}-incoming`} points={points(incoming)} fill="none" stroke="#fff" strokeWidth=".008" />
    <polyline data-testid={`${id}-outgoing`} points={points(outgoing)} fill="none" stroke={contact ? '#ff9f98' : '#7de3ef'} strokeWidth=".009" />
    {objectPath && <polyline data-testid={`${id}-pot`} points={points(objectPath)} fill="none" stroke="#ffc16e" strokeWidth=".009" />}
    {source.balls.map(b => <g key={b.id} data-testid={`${id}-ball-${b.id}`}><circle cx={b.position.x} cy={b.position.y} r={TABLE.ballRadius} fill={b.id === 0 ? '#fff' : b.id === 1 ? '#ffc16e' : '#ff9f98'} /><text x={b.position.x} y={b.position.y + .014} textAnchor="middle" fontSize=".043" fill="#071e1b">{b.id || ''}</text></g>)}
    <g transform={`translate(${rebound.x} ${rebound.y})`}><circle r=".065" fill="#071e1b" stroke="#fff" strokeWidth=".007" /><text y=".016" textAnchor="middle" fontSize=".045" fill="#fff">R1</text></g>
    {contact && <circle data-testid="kick-corridor-contact" cx={contact.x} cy={contact.y} r={TABLE.ballRadius} fill="none" stroke="#fff" strokeWidth=".009" />}
  </svg>
}

export default function KickCorridorComparison({ prepared, result, hidden, busy }: { prepared: PreparedRound; result: RoundAnalysis | null; hidden: boolean; busy: boolean }) {
  const [prediction, setPrediction] = useState<number | null>(null), [retry, setRetry] = useState(false), [showRemoval, setShowRemoval] = useState(false)
  const x = prepared.kickCorridor!, option = prepared.balls[0].options.find(o => o.id === x.referenceId)!
  const e = kickCorridorEvidence(prepared.scenario, option.plan, x)!, revealed = Boolean(result) && !retry
  const clearNumber = prepared.scenario.seed % 2 ? 1 : 2, blockedNumber = 3 - clearNumber
  const blocker = prepared.scenario.balls.find(b => b.id === 3)!
  return <section className="lesson-comparison" aria-label="Kick corridor comparison" hidden={hidden}>
    <h3>Check both legs of the kick</h3>
    <p>Which route clears ball 3 on both sides of its rebound and reaches ball 1?</p>
    <p>Preview paths are simulated with only ball 3 removed, then ball 3 is overlaid at its actual position for clearance reading. White is the incoming leg; cyan is the outgoing leg. The bands show the cue ball’s full width. Both routes target the same pocket.</p>
    <div className="lesson-predictions" role="group" aria-label="Kick corridor prediction">{[1, 2].map(n => <Button key={n} size="sm" variant={prediction === n ? 'default' : 'outline'} aria-pressed={prediction === n} disabled={busy || revealed} onClick={() => setPrediction(n)}>Route {n}</Button>)}</div>
    {revealed && <p role="status"><strong>{prediction === null ? `Route ${clearNumber} clears both legs.` : prediction === clearNumber ? `Correct: route ${clearNumber} clears both legs.` : `Route ${blockedNumber} reaches the rail, but ball 3 blocks the outgoing leg.`}</strong></p>}
    {[1, 2].map(n => {
      const clear = n === clearNumber, route = clear ? e.referenceOpen : e.intended
      return <figure key={n}><figcaption><strong>Route {n}{revealed ? clear ? ` · Reference finish ${option.label}` : ' · Outgoing leg blocked' : ''}</strong></figcaption>
        <RouteDiagram source={prepared.scenario} incoming={revealed && !clear ? e.blockedIncoming : route.incoming} outgoing={revealed && !clear ? e.blockedOutgoing : route.outgoing} rebound={route.first.position} label={`Route ${n}: ${revealed ? 'verified approach outcome' : 'two-leg clearance preview'}`} id={`kick-corridor-route-${n}`} pocketId={option.plan.pocketId} ghost={revealed && !clear ? route.outgoing : undefined} contact={revealed && !clear ? e.contact.position : undefined} objectPath={revealed && clear ? x.reference.objectPath : undefined} />
        {revealed && <p>{clear ? `The reference leaves ${(e.clearIncoming * 1000).toFixed(1)} mm of surface clearance from ball 3 on the incoming leg and ${(e.clearOutgoing * 1000).toFixed(1)} mm on the outgoing leg. Ball 1 is contacted first and potted without a scratch.` : `The incoming leg clears ball 3 by ${(e.incomingClearance * 1000).toFixed(1)} mm. After R1 at ${e.rebound.time.toFixed(2)} s, the cue ball hits ball 3 first at ${e.contact.time.toFixed(2)} s, failing the required first contact with ball 1.`}</p>}
      </figure>
    })}
    {revealed && <>
      <p>Red shows the failed outgoing leg up to its actual first contact; the white ring marks the cue-ball center there. Grey dashes show the continuation with ball 3 removed, not travel through a ball. Later collision motion is omitted. Gold shows the successful object-ball pot.</p>
      <figure><figcaption><strong>Actual first contact · Ball 3 after the cushion</strong></figcaption>
        <svg viewBox={`${blocker.position.x - .14} ${blocker.position.y - .14} .28 .28`} role="img" aria-label="Blocked outgoing leg: actual cue-ball contact with ball 3">
          <rect x={blocker.position.x - .14} y={blocker.position.y - .14} width=".28" height=".28" fill="#143f38" />
          <polyline points={points(e.blockedOutgoing)} fill="none" stroke="#ff9f98" strokeWidth={TABLE.ballDiameter} strokeOpacity=".2" />
          <polyline points={points(e.blockedOutgoing)} fill="none" stroke="#ff9f98" strokeWidth=".003" />
          <circle cx={blocker.position.x} cy={blocker.position.y} r={TABLE.ballRadius} fill="#ff9f98" />
          <text x={blocker.position.x} y={blocker.position.y + .006} textAnchor="middle" fontSize=".018" fill="#071e1b">3</text>
          <circle cx={e.contact.position.x} cy={e.contact.position.y} r={TABLE.ballRadius} fill="none" stroke="#fff" strokeWidth=".002" />
        </svg>
      </figure>
      <Button size="sm" variant="outline" onClick={() => setShowRemoval(v => !v)}>{showRemoval ? 'Hide' : 'Show'} route {blockedNumber} without ball 3</Button>
      {showRemoval && <figure><figcaption><strong>Fixed-stroke removal test · Only ball 3 removed</strong></figcaption>
        <RouteDiagram source={withoutKickBlocker(prepared.scenario)} incoming={e.intended.incoming} outgoing={e.intended.outgoing} rebound={e.intended.first.position} label="Removal test: unchanged stroke now reaches and pots ball 1" id="kick-corridor-removal" pocketId={option.plan.pocketId} objectPath={x.intended.objectPath} />
        <p>Aim, speed, draw/follow, English and every remaining ball stay unchanged. The same stroke takes the same first rebound, contacts ball 1 first and pots it without a scratch. This verifies ball 3 as the obstruction.</p>
      </figure>}
      <p>{result?.selected.plan.id === option.id ? `You chose reference finish ${option.label}.` : `You chose another finish; the clear reference here is finish ${option.label}.`} The blocked candidate and removal test are unscored diagnostics. The three offered finishes remain playable; nominal clearance is not a collision probability.</p>
      <Button size="sm" variant="outline" onClick={() => { setRetry(true); setPrediction(null); setShowRemoval(false) }}>Try the prediction again</Button>
    </>}
    {result && retry && <Button size="sm" onClick={() => setRetry(false)}>Check prediction</Button>}
    <p className="lesson-comparison-note">This prediction is optional and never blocks advancement.</p>
  </section>
}
