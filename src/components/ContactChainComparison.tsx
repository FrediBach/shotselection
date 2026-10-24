import { followContactReplay } from '../engine/follow-contact'
import { verticalSpinDescription } from '../lib/shot-presentation'
import { useState } from 'react'
import { Button } from './ui/button'
import { caromContactReplay } from '../engine/carom-contact'
import { contactChainReplay } from '../engine/contact-chain'
import { evaluateShotObjective } from '../engine/objectives'
import { POCKET_GEOMETRY } from '../engine/table-geometry'
import type { PreparedRound, RoundAnalysis } from '../engine/types'

const name = (id: number) => id === 0 ? 'Cue' : `Ball ${id}`
export default function ContactChainComparison({ prepared, result, hidden }: { prepared: PreparedRound; result: RoundAnalysis | null; hidden: boolean }) {
  const [inspect, setInspect] = useState<string | null>(null), [step, setStep] = useState(0)
  const handoff = prepared.scenario.curriculum?.learning?.comparison === 'carom-plant'
  const stage = (index: number) => index === 1 ? 'carom begins' : index === 2 ? 'cue hands off to ball 2' : 'ball 2 completes the plant'
  const follow = prepared.scenario.curriculum?.learning?.comparison === 'follow-contact'
  const carom = prepared.scenario.curriculum?.learning?.comparison === 'carom-contact'
  const shot = result?.candidates.find(s => s.plan.id === (inspect ?? result.selected.plan.id))
  const replay = shot ? contactChainReplay(prepared.scenario, shot.nominal) : null
  const cueTravel = carom && shot ? caromContactReplay(prepared.scenario, shot.nominal) : null
  const catchUp = follow && shot ? followContactReplay(prepared.scenario, shot.nominal) : null
  const contact = replay?.steps[step - 1], end = Boolean(replay && step > replay.steps.length)
  const balls = end ? shot!.nominal.finalBalls : contact ? contact.event.balls! : prepared.scenario.balls
  const center = contact && !end ? { x: (contact.event.positions[0].x + contact.event.positions[1].x) / 2, y: (contact.event.positions[0].y + contact.event.positions[1].y) / 2 } : null
  const outcome = shot ? evaluateShotObjective(prepared.scenario, shot.plan, shot.nominal) : null
  return <section className="lesson-comparison plant-quality-comparison" aria-label={handoff ? 'Carom plant handoff replay' : follow ? 'Follow catch-up replay' : carom ? 'Carom contact replay' : 'Contact chain replay'} hidden={hidden}>
    <h3>{handoff ? 'Ball 2 takes over from the cue' : follow ? 'The cue catches ball 1 again' : carom ? 'The cue makes both contacts' : 'Follow the extra transfer'}</h3>
    <p>{handoff ? 'The cue makes the first two contacts: cue → 1, then cue → 2. At the handoff, ball 2 becomes the striker for 2 → 3. Reveal these last two impacts separately to see the carom become a plant. English and finish control are familiar tools, not a new contact mechanism.' : follow ? 'Follow carries the cue forward after its first impact. Ball 1 transfers motion to ball 2, then the cue catches ball 1 again. Reveal the two cue → 1 contacts separately and compare their timing with the stroke’s follow and pace.' : carom ? 'A plant follows cue → 1, then 1 → 2. This carom follows cue → 1, then cue → 2. Track the white ball marked C: it makes the second contact that sends ball 2 toward the pocket.' : 'A two-ball plant transfers from 1 to 2. This train adds 2 to 3. The cue starts the chain; ball 2 makes the final scoring contact.'}</p>
    {!shot || !replay ? <p>After committing your shot, reveal each recorded contact one at a time.</p> : <>
      <div className="lesson-predictions" role="group" aria-label={handoff ? 'Inspect handoff stroke' : follow ? 'Inspect follow stroke' : carom ? 'Inspect carom stroke' : 'Inspect train stroke'}>{prepared.balls[0].options.map(option => <Button key={option.id} size="sm" variant={shot.plan.id === option.id ? 'default' : 'outline'} aria-pressed={shot.plan.id === option.id} onClick={() => { setInspect(option.id); setStep(0) }}>Stroke {option.label}</Button>)}</div>
      {follow && <p data-testid="follow-controls">Launch pace: {shot.plan.speed.toFixed(2)} m/s · {verticalSpinDescription(shot.plan)}. Spin is relative to natural rolling at launch, not cue-tip offset.</p>}
      <p role="status">{end ? `Settled result: ${outcome?.success ? 'the full trick succeeds' : 'the full trick does not succeed'}.` : contact ? `Contact ${step}: ${name(contact.pair[0])} → ${name(contact.pair[1])}${handoff ? ` (${stage(step)})` : follow ? step === 1 ? ' (first impact)' : step === 3 ? ' (catch-up impact)' : ' (plant transfer)' : ''} at ${contact.event.time.toFixed(3)} s.` : 'Start: the cue has not yet contacted ball 1.'}</p>
      <svg viewBox={center ? `${center.x - .35} ${center.y - .25} .7 .5` : '-.08 -.08 2.70 1.43'} role="img" aria-label={handoff ? 'Carom plant contact snapshot' : follow ? 'Follow contact snapshot' : carom ? 'Carom contact snapshot' : 'Train contact snapshot'}>
        <rect width="2.54" height="1.27" rx=".04" fill="#143f38" />
        {POCKET_GEOMETRY.map(p => <circle key={p.id} cx={p.center.x} cy={p.center.y} r=".045" fill="#071e1b" />)}
        {cueTravel && step >= 2 && <polyline data-testid="carom-cue-travel" points={cueTravel.points.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#7de3ef" strokeWidth=".01" strokeDasharray=".025 .015" />}
        {balls.filter(ball => !('pocketed' in ball && ball.pocketed)).map(ball => <g key={ball.id} data-testid={`chain-ball-${ball.id}`}>
          <circle cx={ball.position.x} cy={ball.position.y} r=".029" fill={ball.id === 0 ? '#fff' : '#ffc16e'} />
          <text x={ball.position.x} y={ball.position.y + .014} textAnchor="middle" fontSize=".042" fill="#071e1b">{ball.id || (carom || follow || handoff ? 'C' : '')}</text>
          {!end && contact?.pair.includes(ball.id) && <circle cx={ball.position.x} cy={ball.position.y} r=".042" fill="none" stroke="#7de3ef" strokeWidth=".007" />}
        </g>)}
      </svg>
      {carom && step >= 2 && <p>{cueTravel ? 'Cyan dashes trace the cue ball from its contact with ball 1 to its contact with ball 2. The white C ball makes that second impact; ball 1 is not the striker.' : 'The cue’s recorded travel is unavailable for this result.'}</p>}
      {handoff && step >= 2 && <p data-testid="carom-plant-handoff">{step === 2 ? 'Handoff: the white cue C contacts ball 2. The 2 → 3 plant is the next required impact.' : 'Plant: ball 2 contacts ball 3. Ball 2 is now the striker; the cue does not make this final scoring contact.'}</p>}
      {follow && step >= 3 && <p data-testid="follow-catch-up">{catchUp ? `The second cue → 1 impact occurs ${catchUp.elapsed.toFixed(3)} s after the first. Just before it, the cue closes on ball 1 at ${catchUp.closingSpeed.toFixed(2)} m/s along their line of centers. These are two distinct impacts with the 1 → 2 transfer between them.` : 'The recorded catch-up measurement is unavailable.'}</p>}
      <ol aria-label="Revealed contacts">{replay.steps.slice(0, Math.min(step, replay.steps.length)).map((s, i) => <li key={i}>{name(s.pair[0])} → {name(s.pair[1])}{handoff ? ` · ${stage(i + 1)}` : follow ? i === 0 ? ' · first impact' : i === 2 ? ' · catch-up impact' : ' · plant transfer' : ''}</li>)}</ol>
      <div className="lesson-predictions">
        <Button size="sm" variant="outline" disabled={step === 0} onClick={() => setStep(value => value - 1)}>Previous step</Button>
        <Button size="sm" disabled={end} onClick={() => setStep(value => value + 1)}>{step < replay.steps.length ? 'Reveal next contact' : 'Show settled result'}</Button>
        <Button size="sm" variant="outline" onClick={() => setStep(0)}>Restart contacts</Button>
      </div>
      {!replay.complete && <p>The recorded sequence is incomplete. Missing contacts are not filled in.</p>}
      <p>{end && follow ? `Ball 1 ${shot.nominal.potted.includes(1) ? 'was potted' : 'was not potted'}; ball 2 ${shot.nominal.potted.includes(2) ? 'was potted' : 'was not potted'}. The complete trick also requires both cue → 1 contacts in order, the nominated pocket and a safe settled finish.` : end ? `Ball ${carom ? 2 : 3} ${shot.nominal.potted.includes(carom ? 2 : 3) ? 'was potted' : 'was not potted'}. The full objective also checks the contact order, nominated pocket and safe settled finish.` : contact ? 'Close-up: cyan rings identify the two balls making this contact. The balls are shown at their recorded positions at that instant.' : 'The snapshot starts from the authored layout. Later contacts stay hidden until you reveal them.'}</p>
      {follow && <p>The offered strokes change pace and follow together. Compare their combined settings and recorded timing; this replay does not isolate spin as the cause of a difference.</p>}
      <p>This is the inspected stroke’s nominal simulation. The ordinary trial results measure execution variation; stepping through these contacts does not change your score.</p>
    </>}
    <p className="lesson-comparison-note">The replay is optional and never blocks advancement.</p>
  </section>
}
