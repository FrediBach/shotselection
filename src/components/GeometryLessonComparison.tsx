import { useState } from 'react'
import { TABLE } from '@/engine/constants'
import { POCKET_GEOMETRY, RAILS } from '@/engine/table-geometry'
import { centeredCueReference, directShotGeometry, objectLineError } from '@/engine/shot-geometry'
import type { PreparedRound, RoundAnalysis, ShotPlan, Scenario, Vec2 } from '@/engine/types'
import { Button } from './ui/button'

const pathPoints = (points: Vec2[]) => points.map(p => `${p.x},${p.y}`).join(' ')
const cm = (value: number) => `${(value * 100).toFixed(1)} cm`

function RoutePreview({ prepared }: { prepared: PreparedRound }) {
  return <svg viewBox="-.08 -.08 2.70 1.43" role="img" aria-label="Both offered potting lines: cyan cue approaches and gold object-to-pocket routes.">
    <rect width="2.54" height="1.27" rx=".04" fill="#143f38" />
    {POCKET_GEOMETRY.map(p => <circle key={p.id} cx={p.center.x} cy={p.center.y} r=".045" fill="#071e1b" />)}
    {prepared.balls.map(ball => {
      const g = directShotGeometry(prepared.scenario, ball.options[0].plan)
      return <g key={ball.ballId}>
        <polyline points={pathPoints([g.cue, g.ghost])} fill="none" stroke="#7de3ef" strokeWidth=".012" />
        <polyline points={pathPoints([g.object, g.pocket.center])} fill="none" stroke="#ffc16e" strokeWidth=".012" />
        <circle cx={g.ghost.x} cy={g.ghost.y} r={TABLE.ballRadius} fill="none" stroke="#7de3ef" strokeWidth=".006" />
      </g>
    })}
    {prepared.scenario.balls.map(ball => <g key={ball.id}><circle cx={ball.position.x} cy={ball.position.y} r={TABLE.ballRadius} fill={ball.id === 0 ? 'white' : '#ffc16e'} />{ball.id > 0 && <text x={ball.position.x} y={ball.position.y - .05} textAnchor="middle" fontSize=".075" fill="white">{ball.id}</text>}</g>)}
  </svg>
}

function GeometryDiagram({ scenario, plan }: { scenario: Scenario; plan: ShotPlan }) {
  const g = directShotGeometry(scenario, plan)
  const comparison = scenario.curriculum!.learning!.comparison
  if (comparison === 'pocket-entry') {
    const middle = g.pocket.mouthCenter
    const normal = { x: -g.direction.y, y: g.direction.x }
    const across = (distance: number): Vec2 => ({ x: middle.x - g.direction.x * .07 + normal.x * distance, y: middle.y - g.direction.y * .07 + normal.y * distance })
    const start = { x: middle.x - g.direction.x * .17, y: middle.y - g.direction.y * .17 }
    return <svg viewBox={`${middle.x - .25} ${middle.y - .25} .5 .5`} role="img" aria-label={`Pocket-entry geometry for ball ${plan.ballId}: gold mouth, cyan clearance across the incoming path.`}>
      <rect x={middle.x - .25} y={middle.y - .25} width=".5" height=".5" fill="#143f38" />
      <circle cx={g.pocket.center.x} cy={g.pocket.center.y} r={g.pocket.radius} fill="#071e1b" />
      {RAILS.map((rail, index) => <line key={index} x1={rail.a.x} y1={rail.a.y} x2={rail.b.x} y2={rail.b.y} stroke="#8d9c83" strokeWidth=".006" />)}
      <polyline points={pathPoints(g.pocket.mouth)} fill="none" stroke="#ffc16e" strokeWidth=".006" />
      <polyline points={pathPoints([start, middle, g.pocket.center])} fill="none" stroke="white" strokeWidth=".002" strokeDasharray=".008 .006" />
      <polyline points={pathPoints([across(-g.projectedClearance / 2), across(g.projectedClearance / 2)])} fill="none" stroke="#7de3ef" strokeWidth=".006" />
      <circle cx={start.x} cy={start.y} r={TABLE.ballRadius} fill="#ffc16e" />
    </svg>
  }
  const reference = directShotGeometry(centeredCueReference(scenario), plan)
  const error = objectLineError(g)
  return <svg viewBox="-.08 -.08 2.70 1.43" role="img" aria-label={comparison === 'object-travel' ? `Ball ${plan.ballId}: intended object line and the same one-degree outgoing error.` : `Ball ${plan.ballId}: actual cue approach and a dashed centered-cue reference.`}>
    <rect width="2.54" height="1.27" rx=".04" fill="#143f38" />
    {POCKET_GEOMETRY.map(p => <circle key={p.id} cx={p.center.x} cy={p.center.y} r=".045" fill="#071e1b" />)}
    {comparison === 'off-center-cue' && <>
      <polyline points={pathPoints([reference.cue, reference.ghost])} fill="none" stroke="#b6c3b2" strokeWidth=".012" strokeDasharray=".035 .025" />
      <circle cx={reference.cue.x} cy={reference.cue.y} r={TABLE.ballRadius} fill="none" stroke="#b6c3b2" strokeWidth=".009" />
    </>}
    <polyline points={pathPoints([g.cue, g.ghost])} fill="none" stroke="#7de3ef" strokeWidth=".012" />
    <polyline points={pathPoints([g.object, g.pocket.center])} fill="none" stroke="#ffc16e" strokeWidth=".012" />
    {comparison === 'object-travel' && <>
      <polyline points={pathPoints([g.object, error.endpoint])} fill="none" stroke="#ff9f98" strokeWidth=".01" strokeDasharray=".035 .025" />
      <polyline points={pathPoints([g.pocket.center, error.endpoint])} fill="none" stroke="white" strokeWidth=".015" />
    </>}
    <circle cx={g.ghost.x} cy={g.ghost.y} r={TABLE.ballRadius} fill="none" stroke="#7de3ef" strokeWidth=".006" />
    {scenario.balls.map(ball => <g key={ball.id}><circle cx={ball.position.x} cy={ball.position.y} r={TABLE.ballRadius} fill={ball.id === 0 ? 'white' : '#ffc16e'} />{ball.id > 0 && <text x={ball.position.x} y={ball.position.y - .05} textAnchor="middle" fontSize=".075" fill="white">{ball.id}</text>}</g>)}
  </svg>
}

/** Both balls' offered routes are compared; the outcome is independent of which
 * opener the player chooses and never substitutes geometry for a pot rate. */
export default function GeometryLessonComparison({ prepared, result, busy }: { prepared: PreparedRound; result: RoundAnalysis | null; busy: boolean }) {
  const [prediction, setPrediction] = useState<number | null>(null)
  const [retrying, setRetrying] = useState(false)
  const { scenario } = prepared
  const comparison = scenario.curriculum!.learning!.comparison
  const routes = prepared.balls.map(ball => ({ ballId: ball.ballId, plan: ball.options[0].plan, geometry: directShotGeometry(scenario, ball.options[0].plan) }))
  const travel = comparison === 'object-travel'
  const symmetry = comparison === 'off-center-cue'
  const metric = (g: ReturnType<typeof directShotGeometry>) => travel ? g.objectDistance : symmetry ? -g.cutDegrees : g.projectedClearance
  const greatest = Math.max(...routes.map(route => metric(route.geometry)))
  const correct = routes.filter(route => Math.abs(metric(route.geometry) - greatest) < 1e-8).map(route => route.ballId)
  const revealed = Boolean(result) && !retrying
  const question = travel ? 'Which object-ball route spreads the same 1° outgoing direction error farther at the pocket?' : symmetry ? 'With the cue ball off-center, which corner pot needs the fuller contact (smaller cut)?' : 'Which route has more mouth clearance across the direction the object ball enters?'
  return <section className="lesson-comparison" aria-label="Lesson comparison">
    <h3>{revealed ? 'Check your geometry prediction' : 'Compare the two pots'}</h3>
    {!revealed && <><RoutePreview prepared={prepared} /><p className="lesson-comparison-note">Cyan: cue approaches · Gold: object-to-pocket lines · Rings: ghost-ball positions.</p></>}
    <p>{question}</p>
    <div className="lesson-predictions" role="group" aria-label="Your prediction">{routes.map(route => <Button key={route.ballId} size="sm" variant={prediction === route.ballId ? 'default' : 'outline'} aria-pressed={prediction === route.ballId} disabled={busy || revealed} onClick={() => { setPrediction(route.ballId); if (retrying) setRetrying(false) }}>Ball {route.ballId}</Button>)}</div>
    {!result && <p className="lesson-comparison-note">Predict before choosing your opener, then inspect the comparison after locking in your shot. This optional check does not select a ball for you.</p>}
    {revealed && <div aria-live="polite">
      <p><strong>{prediction === null ? 'Inspect the two offered routes.' : correct.includes(prediction) ? 'Your prediction matches the geometry.' : 'Compare the geometry once more.'}</strong> {travel ? 'Cyan shows the nearly matched cue approaches. Gold shows each intended object-ball line; dashed pink adds the same 1° outgoing error. The white segment measures sideways displacement at the pocket plane. This is a geometric illustration, not a simulated miss or a change to your stroke.' : symmetry ? 'The dashed line starts from a centered-cue reference; cyan starts from the actual cue ball. Both incoming approaches change when the cue moves. The gold object-to-pocket lines and required ghost-ball positions stay fixed.' : 'Gold marks the physical pocket mouth. Cyan shows the opening projected across the incoming direction, less one ball diameter. The dashed line shows the incoming route. This mouth-plane illustration does not include jaw and shelf effects and is not a measured potting tolerance.'}</p>
      {routes.map(({ ballId, plan, geometry: g }) => {
        const reference = directShotGeometry(centeredCueReference(scenario), plan)
        const error = objectLineError(g)
        const chosen = result?.selected.plan.ballId === ballId
        return <figure key={ballId}>
          <figcaption><strong>Ball {ballId}{chosen ? ' · your opener' : ''}</strong> · {g.pocket.name} pocket</figcaption>
          <GeometryDiagram scenario={scenario} plan={plan} />
          <dl className="geometry-measures">
            {travel ? <>
              <div><dt>Cue approach</dt><dd>{g.cueDistance.toFixed(2)} m</dd></div>
              <div><dt>Cut at contact</dt><dd>{g.cutDegrees.toFixed(1)}°</dd></div>
              <div><dt>Object-ball journey</dt><dd>{g.objectDistance.toFixed(2)} m</dd></div>
              <div><dt>1° error displacement</dt><dd>{cm(error.displacement)}</dd></div>
            </> : symmetry ? <>
              <div><dt>Centered-cue cut</dt><dd>{reference.cutDegrees.toFixed(1)}°</dd></div>
              <div><dt>Actual cut</dt><dd>{g.cutDegrees.toFixed(1)}°</dd></div>
              <div><dt>Object-ball journey</dt><dd>{g.objectDistance.toFixed(2)} m</dd></div>
            </> : <>
              <div><dt>Cut at contact</dt><dd>{g.cutDegrees.toFixed(1)}°</dd></div>
              <div><dt>Entry from mouth normal</dt><dd>{g.entryDegrees.toFixed(1)}°</dd></div>
              <div><dt>Projected mouth clearance</dt><dd>{cm(g.projectedClearance)}</dd></div>
            </>}
          </dl>
        </figure>
      })}
      <p>{travel ? 'The longer object-ball route magnifies the same outgoing direction error. Compare the ensemble results separately to judge the complete strokes.' : symmetry ? 'Symmetric pockets alone do not imply equal cuts. Re-read both cue approaches when the cue position changes.' : 'Here the corner entry is cleaner but its cut is thinner. Use both facts when judging the whole shot; mouth clearance alone does not determine the winning stroke.'}</p>
      <Button variant="outline" size="sm" onClick={() => { setPrediction(null); setRetrying(true) }}>Try the prediction again</Button>
      <p className="lesson-comparison-note">This check is practice. You can continue regardless of your answer.</p>
    </div>}
  </section>
}
