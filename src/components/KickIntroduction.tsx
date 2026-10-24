import { useId, useState } from 'react'
import { Button } from './ui/button'
import { kickIntroductionEvidence } from '../engine/kick-introduction'
import { TABLE } from '../engine/constants'
import { POCKET_GEOMETRY } from '../engine/table-geometry'
import type { PreparedRound, RoundAnalysis, Vec2 } from '../engine/types'

const points = (path: Vec2[]) => path.map(p => `${p.x},${p.y}`).join(' ')
export default function KickIntroduction({ prepared, result, hidden, busy }: { prepared: PreparedRound; result: RoundAnalysis | null; hidden: boolean; busy: boolean }) {
  const [prediction, setPrediction] = useState<string | null>(null), [retry, setRetry] = useState(false)
  const marker = useId(), revealed = Boolean(result) && !retry
  const evidence = result ? kickIntroductionEvidence(prepared.scenario, result.selected.nominal) : null
  const option = prepared.balls.flatMap(b => b.options).find(o => o.id === result?.selected.plan.id)
  return <section className="lesson-comparison" aria-label="Kick-shot introduction" hidden={hidden}>
    <h3>Which ball takes the cushion first?</h3>
    <p>Ball 2 screens the direct approach to ball 1. In this lesson, which ball must reach a cushion before the first ball-to-ball contact?</p>
    <div className="lesson-predictions" role="group" aria-label="Kick-shot prediction">{['Cue ball', 'Ball 1'].map(answer => <Button key={answer} size="sm" variant={prediction === answer ? 'default' : 'outline'} aria-pressed={prediction === answer} disabled={busy || revealed} onClick={() => setPrediction(answer)}>{answer}</Button>)}</div>
    {revealed && evidence && <>
      <p role="status"><strong>{prediction === null ? 'Trace the cue ball to its first cushion.' : prediction === 'Cue ball' ? 'Correct: the cue ball rebounds before contacting ball 1.' : 'The cue ball must take the cushion first.'}</strong></p>
      <p>This is a <strong>kick shot</strong>: the cue ball rebounds before hitting the object ball. In an object-ball bank, the object ball rebounds on its way to a pocket.</p>
      <figure><figcaption><strong>Selected finish {option?.label} · Required rebound R1</strong></figcaption>
        <svg viewBox="-.08 -.08 2.70 1.43" role="img" aria-label="Selected kick: required cue-ball rebound R1 before contact with ball 1">
          <defs><marker id={marker} markerWidth="4" markerHeight="4" refX="3" refY="2" orient="auto"><path d="M0,0 L4,2 L0,4 Z" fill="#7de3ef" /></marker></defs>
          <rect width="2.54" height="1.27" rx=".04" fill="#143f38" />
          {POCKET_GEOMETRY.map(p => <circle key={p.id} cx={p.center.x} cy={p.center.y} r=".045" fill="#071e1b" />)}
          <polyline points={points(result!.selected.nominal.cuePath)} fill="none" stroke="#c8cfcc" strokeOpacity=".45" strokeWidth=".006" strokeDasharray=".025 .02" />
          <polyline points={points(result!.selected.nominal.objectPath)} fill="none" stroke="#ffc16e" strokeWidth=".009" />
          <polyline points={points(evidence.incoming)} fill="none" stroke="#7de3ef" strokeWidth=".012" />
          <polyline points={points(evidence.outgoing)} fill="none" stroke="#7de3ef" strokeWidth=".012" markerEnd={`url(#${marker})`} />
          <circle cx={evidence.contact.position.x} cy={evidence.contact.position.y} r={TABLE.ballRadius} fill="none" stroke="#fff" strokeWidth=".006" />
          {prepared.scenario.balls.map(b => <g key={b.id}><circle cx={b.position.x} cy={b.position.y} r={TABLE.ballRadius} fill={b.id === 0 ? '#fff' : b.id === 2 ? '#ff9f98' : '#ffc16e'} /><text x={b.position.x} y={b.position.y + .014} textAnchor="middle" fontSize=".043" fill="#071e1b">{b.id || ''}</text></g>)}
          <g data-testid="required-kick-rebound" transform={`translate(${evidence.first.position.x} ${evidence.first.position.y})`}><circle r=".065" fill="#071e1b" stroke="#7de3ef" strokeWidth=".007" /><text y=".016" textAnchor="middle" fontSize=".045" fill="#fff">R1</text></g>
        </svg>
      </figure>
      <ol><li>Cue-ball rebound R1: {evidence.first.time.toFixed(2)} s after launch.</li><li>First object-ball contact: ball {evidence.contact.ballId} at {evidence.contact.time.toFixed(2)} s.</li><li>Ball 1 is potted without a scratch in this nominal simulation.</li></ol>
      <p>Cyan shows the cue-ball approach through the recorded rebound. The white ring marks its center at first contact; gold shows ball 1’s path. Grey dashes show the later cue-ball travel. Balls are drawn at their starting positions.</p>
      <p className="lesson-comparison-note">All three offered finishes already satisfy the cushion-first requirement nominally. Your regular task remains choosing the most forgiving complete stroke; one replay does not measure reliability.</p>
      <Button size="sm" variant="outline" onClick={() => { setRetry(true); setPrediction(null) }}>Try the prediction again</Button>
    </>}
    {revealed && !evidence && <p role="status">The required rebound could not be verified for this result.</p>}
    {result && retry && <Button size="sm" onClick={() => setRetry(false)}>Check prediction</Button>}
    <p className="lesson-comparison-note">This prediction is optional and never blocks advancement.</p>
  </section>
}
