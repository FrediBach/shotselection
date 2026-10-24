import { useState } from 'react'
import { Button } from './ui/button'
import { kickPaceEvidence, reboundSpeed } from '../engine/kick-pace'
import { TABLE } from '../engine/constants'
import { POCKET_GEOMETRY } from '../engine/table-geometry'
import type { PreparedRound, RoundAnalysis, Vec2 } from '../engine/types'

const points = (path: Vec2[]) => path.map(p => `${p.x},${p.y}`).join(' ')
export default function KickPaceComparison({ prepared, result, hidden, busy }: { prepared: PreparedRound; result: RoundAnalysis | null; hidden: boolean; busy: boolean }) {
  const [prediction, setPrediction] = useState<string | null>(null), [retry, setRetry] = useState(false)
  const experiment = prepared.kickPace!, option = prepared.balls[0].options.find(o => o.id === experiment.referenceId)!
  const evidence = kickPaceEvidence(prepared.scenario, option.plan, experiment.reference, experiment.weakPlan, experiment.weak)!
  const revealed = Boolean(result) && !retry
  const answers = ['Stops before ball 1', 'Reaches ball 1']
  return <section className="lesson-comparison" aria-label="Kick pace comparison" hidden={hidden}>
    <h3>Budget speed beyond the cushion</h3>
    <p>Use finish {option.label} as the reference. Lower its launch speed from {option.plan.speed.toFixed(2)} to {experiment.weakPlan.speed.toFixed(2)} m/s ({Math.round((1 - experiment.multiplier) * 100)}% less), keeping aim, initial ball rotation and the layout fixed. After the cushion, will the weaker attempt reach ball 1?</p>
    <p>The weaker attempt is a separate, unscored experiment. Draw/follow is expressed relative to rolling speed in the regular controls; that percentage is adjusted here to preserve the same actual starting rotation.</p>
    <div className="lesson-predictions" role="group" aria-label="Kick pace prediction">{answers.map(answer => <Button key={answer} size="sm" variant={prediction === answer ? 'default' : 'outline'} aria-pressed={prediction === answer} disabled={busy || revealed} onClick={() => setPrediction(answer)}>{answer}</Button>)}</div>
    {revealed && <>
      <p role="status"><strong>{prediction === null ? 'The weaker attempt stops before ball 1.' : prediction === answers[0] ? 'Correct: the weaker attempt stops before ball 1.' : 'It reaches the cushion, but stops before ball 1.'}</strong></p>
      <p>Both strokes lose cue-ball speed at their first rebound. The cloth also slows the ball before and after the cushion. This comparison changes launch speed; it does not isolate cushion loss from cloth loss.</p>
      {[{ key: 'reference', title: `Reference finish ${option.label}`, simulation: experiment.reference, rebound: evidence.good, speed: option.plan.speed }, { key: 'weak', title: 'Weaker attempt', simulation: experiment.weak, rebound: evidence.weak, speed: experiment.weakPlan.speed }].map(({ key, title, simulation, rebound, speed }) => <figure key={key}>
        <figcaption><strong>{title}</strong></figcaption>
        <svg viewBox="-.08 -.08 2.70 1.43" role="img" aria-label={`${title}: actual kick path and stopping point`}>
          <rect width="2.54" height="1.27" rx=".04" fill="#143f38" />
          {POCKET_GEOMETRY.map(p => <circle key={p.id} cx={p.center.x} cy={p.center.y} r=".045" fill="#071e1b" />)}
          <polyline data-testid={`kick-pace-path-${key}`} points={points(simulation.cuePath)} fill="none" stroke="#7de3ef" strokeWidth=".01" />
          {key === 'reference' && <polyline points={points(simulation.objectPath)} fill="none" stroke="#ffc16e" strokeWidth=".009" />}
          {prepared.scenario.balls.map(b => <g key={b.id}><circle cx={b.position.x} cy={b.position.y} r={TABLE.ballRadius} fill={b.id === 0 ? '#fff' : b.id === 1 ? '#ffc16e' : '#ff9f98'} /><text x={b.position.x} y={b.position.y + .014} textAnchor="middle" fontSize=".043" fill="#071e1b">{b.id || ''}</text></g>)}
          <g transform={`translate(${rebound.position.x} ${rebound.position.y})`}><circle r=".065" fill="#071e1b" stroke="#7de3ef" strokeWidth=".007" /><text y=".016" textAnchor="middle" fontSize=".045" fill="#fff">R1</text></g>
          <circle data-testid={`kick-pace-stop-${key}`} cx={simulation.cueEnd.x} cy={simulation.cueEnd.y} r={TABLE.ballRadius} fill="none" stroke="#fff" strokeWidth=".009" />
        </svg>
        <table className="kick-pace-speeds" aria-label={`${title}: measured speeds`}><thead><tr><th>Measurement</th><th>Cue-ball speed</th></tr></thead><tbody>
          <tr><th>Launch</th><td>{speed.toFixed(2)} m/s</td></tr>
          <tr><th>Just before R1</th><td>{reboundSpeed(rebound.incoming).toFixed(2)} m/s</td></tr>
          <tr><th>Just after R1</th><td>{reboundSpeed(rebound.outgoing).toFixed(2)} m/s</td></tr>
        </tbody></table>
        <p>{key === 'reference' ? 'Ball 1 is potted without a scratch in this nominal simulation.' : `The cue ball rebounds, then settles without contacting any object ball. Its surface stops ${(evidence.gap * 100).toFixed(1)} cm from ball 1; all object balls remain in place.`}</p>
      </figure>)}
      <p>Cyan is actual cue-ball travel; gold is ball 1’s actual pot path. R1 marks the recorded first rebound. White rings mark final cue-ball centers; filled balls show starting positions. The two paths can differ as speed and spin evolve.</p>
      <p>{result?.selected.plan.id === option.id ? `You chose reference finish ${option.label}.` : `You chose another finish; this experiment uses finish ${option.label}.`} All three offered finishes remain nominally playable. This single weaker attempt does not measure stroke reliability or the minimum speed needed.</p>
      <Button size="sm" variant="outline" onClick={() => { setRetry(true); setPrediction(null) }}>Try the prediction again</Button>
    </>}
    {result && retry && <Button size="sm" onClick={() => setRetry(false)}>Check prediction</Button>}
    <p className="lesson-comparison-note">This prediction is optional and never blocks advancement.</p>
  </section>
}
