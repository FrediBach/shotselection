import { useMemo, useState } from 'react'
import { corridorPairFinder, type Corridor } from '../engine/corridor-diagnosis'
import { simulateShot } from '../engine/physics'
import { directNextShotRoutes } from '../engine/objectives'
import { POCKET_GEOMETRY } from '../engine/table-geometry'
import { TABLE } from '../engine/constants'
import type { PreparedRound, RoundAnalysis } from '../engine/types'
import { Button } from './ui/button'

export default function CorridorDiagnosis({ prepared, result, ready, busy, onReady }: { prepared: PreparedRound; result: RoundAnalysis | null; ready: boolean; busy: boolean; onReady: () => void }) {
  const [answers, setAnswers] = useState<Record<string, Corridor>>({})
  const [removed, setRemoved] = useState<string | null>(null)
  const [retry, setRetry] = useState(false)
  const cases = useMemo(() => {
    const entries = prepared.balls[0].options.map(o => ({ plan: o.plan, simulation: result?.candidates.find(c => c.plan.id === o.id)?.nominal ?? simulateShot(prepared.scenario, o.plan, { record: false }) }))
    return corridorPairFinder(prepared.scenario)(entries)?.sort((a, b) => a.opening.plan.id.localeCompare(b.opening.plan.id)) ?? []
  }, [prepared, result])
  const revealed = ready && cases.length === 2 && cases.every(c => answers[c.opening.plan.id])
  const label = (id: string) => prepared.balls[0].options.find(o => o.id === id)!.label
  const name = (c: Corridor) => c === 'approach' ? 'Cue-ball approach' : 'Object-to-pocket line'
  return <section className="lesson-comparison" aria-label="Corridor diagnosis">
    <h3>Which corridor is blocked?</h3>
    <p>Inspect both predicted finishes before choosing a stroke. For each named pocket, identify the corridor blocked by the highlighted spare ball. Cyan is the cue approach to the contact ring; gold is ball 2’s pocket line.</p>
    {cases.map((item, i) => {
      const id = item.opening.plan.id, e = item.evidence, without = removed === id && revealed
      return <div className="corridor-case" key={id}>
        <h4>Case {'AB'[i]} · stroke {label(id)} · {e.pocket.name} pocket</h4>
        <p>Check ball {e.blocker.id}.</p>
        <svg viewBox="-.08 -.08 2.70 1.43" role="img" aria-label={`Case ${'AB'[i]}: ${without ? 'counterfactual with blocker removed' : 'settled layout and two corridors'}`}>
          <rect width="2.54" height="1.27" rx=".04" fill="#143f38" />
          {POCKET_GEOMETRY.map(p => <circle key={p.id} cx={p.center.x} cy={p.center.y} r=".045" fill={p.id === e.pocket.id ? '#ffc16e' : '#071e1b'} />)}
          <line x1={e.cue.position.x} y1={e.cue.position.y} x2={e.route.ghost.x} y2={e.route.ghost.y} stroke="#7de3ef" strokeWidth=".012" strokeDasharray={revealed && !without && e.corridor === 'approach' ? '.035 .02' : undefined} />
          <line x1={e.object.position.x} y1={e.object.position.y} x2={e.pocket.center.x} y2={e.pocket.center.y} stroke="#ffc16e" strokeWidth=".012" strokeDasharray={revealed && !without && e.corridor === 'pocket' ? '.035 .02' : undefined} />
          <circle cx={e.route.ghost.x} cy={e.route.ghost.y} r={TABLE.ballRadius} fill="none" stroke="#7de3ef" strokeWidth=".006" />
          {e.balls.filter(b => !without || b.id !== e.blocker.id).map(b => <g key={b.id}>
            {b.id === e.blocker.id && <circle cx={b.position.x} cy={b.position.y} r={TABLE.ballDiameter * 1.025} fill="#ff9f98" fillOpacity=".1" stroke="#ff9f98" strokeWidth=".006" strokeDasharray=".015 .01" />}
            <circle cx={b.position.x} cy={b.position.y} r={TABLE.ballRadius} fill={b.id === 0 ? '#fff' : b.id === e.blocker.id ? '#ff9f98' : '#ffc16e'} />
            <text x={b.position.x} y={b.position.y + .014} textAnchor="middle" fontSize=".043" fill="#071e1b">{b.id || ''}</text>
          </g>)}
        </svg>
        <div className="lesson-predictions" role="group" aria-label={`Case ${'AB'[i]} diagnosis`}>{(['approach', 'pocket'] as const).map(c => <Button key={c} size="sm" variant={answers[id] === c ? 'default' : 'outline'} aria-pressed={answers[id] === c} disabled={busy || Boolean(result && !retry)} onClick={() => {
          const next = { ...answers, [id]: c }; setAnswers(next)
          if (cases.every(entry => next[entry.opening.plan.id])) { onReady(); setRetry(false) }
        }}>{name(c)}</Button>)}</div>
        {revealed && <>
          <p role="status"><strong>{answers[id] === e.corridor ? 'Correct.' : 'Check the other corridor.'}</strong> Ball {e.blocker.id} blocks the {name(e.corridor).toLowerCase()}; the other corridor is clear. This named route is unavailable within the {prepared.scenario.objective!.maxCutAngle}° cut limit.</p>
          <Button size="sm" variant="outline" aria-expanded={without} onClick={() => setRemoved(without ? null : id)}>{without ? 'Restore blocker' : `Remove only ball ${e.blocker.id} in case ${'AB'[i]}`}</Button>
          {without && <p>Counterfactual: only ball {e.blocker.id} is removed. Every other ball stays fixed. The named route returns at a {e.route.cutAngle.toFixed(1)}° cut. This proves geometric access, not a pot.</p>}
        </>}
      </div>
    })}
    {revealed ? <>
      <p>Now compare the opening finishes. A failed named pocket does not mean every next pocket is blocked. The dashed clearance circle marks the forbidden area for a moving ball’s center, not a larger physical ball.</p>
      {result && <div aria-label="Actual finish route counts">{result.candidates.map(shot => <p key={shot.plan.id}>Stroke {label(shot.plan.id)}: {directNextShotRoutes(prepared.scenario, shot.nominal).length} permitted next routes.</p>)}</div>}
      <Button size="sm" variant="outline" disabled={busy} onClick={() => { setAnswers({}); setRemoved(null); setRetry(true) }}>Try the diagnosis again</Button>
    </> : <p role="status">{ready ? 'Answer both cases to see the explanations again.' : 'Answer both cases to unlock stroke selection. Either answer is accepted; the explanation follows.'}</p>}
    <p className="lesson-comparison-note">These are nominal simulated opening finishes with all remaining balls retained. The score checks the opening pot, zone and access to any next pocket. Diagnosis accuracy does not change your score or block advancement.</p>
  </section>
}
