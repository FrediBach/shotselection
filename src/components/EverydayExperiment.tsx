import { useState } from 'react'
import { POCKET_GEOMETRY } from '@/engine/table-geometry'
import { postContactRebounds } from '@/engine/lesson-evidence'
import { speedProbeSummary } from '@/engine/everyday-experiments'
import { directShotGeometry } from '@/engine/shot-geometry'
import type { LessonExperiment, PreparedRound, RoundAnalysis, Vec2 } from '@/engine/types'
import { Button } from './ui/button'

const points = (path: Vec2[]) => path.map(p => `${p.x},${p.y}`).join(' ')
function ExperimentDiagram({ prepared, variant }: { prepared: PreparedRound; variant: LessonExperiment['variants'][number] }) {
  const sim = variant.simulation
  return <svg viewBox="-.08 -.08 2.70 1.43" role="img" aria-label={`${variant.label}: measured cue and object paths${sim.scratch ? ', ending in a cue-ball scratch' : ''}.`}>
    <rect width="2.54" height="1.27" rx=".04" fill="#143f38" />
    {POCKET_GEOMETRY.map(p => <circle key={p.id} cx={p.center.x} cy={p.center.y} r=".045" fill="#071e1b" />)}
    <polyline points={points(sim.cuePath)} fill="none" stroke="#7de3ef" strokeWidth=".012" />
    <polyline points={points(sim.objectPath)} fill="none" stroke="#ffc16e" strokeWidth=".012" />
    {postContactRebounds(sim).map((event, i) => <circle key={i} cx={event.position.x} cy={event.position.y} r=".04" fill="none" stroke="white" strokeWidth=".008" />)}
    {variant.speedTrials?.map((trial, i) => <circle key={i} cx={trial.simulation.cueEnd.x} cy={trial.simulation.cueEnd.y} r=".018" fill={trial.simulation.scratch ? '#ff9f98' : '#9fe7b7'} />)}
    {sim.firstImpact && <circle cx={sim.firstImpact.position.x} cy={sim.firstImpact.position.y} r=".04" fill="none" stroke="#ffc16e" strokeWidth=".008" />}
    <circle cx={sim.cueEnd.x} cy={sim.cueEnd.y} r=".03" fill="none" stroke={sim.scratch ? '#ff9f98' : 'white'} strokeWidth=".012" />
    {prepared.scenario.balls.map(ball => <g key={ball.id}><circle cx={ball.position.x} cy={ball.position.y} r=".029" fill={ball.id === 0 ? 'white' : '#ffc16e'} />{ball.id > 0 && <text x={ball.position.x} y={ball.position.y - .05} textAnchor="middle" fontSize=".075" fill="white">{ball.id}</text>}</g>)}
  </svg>
}

export default function EverydayExperiment({ prepared, result, busy }: { prepared: PreparedRound; result: RoundAnalysis | null; busy: boolean }) {
  const [prediction, setPrediction] = useState<number | null>(null)
  const [shown, setShown] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const experiment = prepared.experiment!
  const scratch = experiment.kind === 'scratch-line', cushion = experiment.kind === 'avoidable-cushion'
  const revealed = !retrying && (shown || Boolean(result))
  const choices = experiment.variants.slice(0, 2)
  const correct = scratch ? choices.findIndex(v => v.simulation.scratch) : cushion ? choices.findIndex(v => { const s = speedProbeSummary(v); return s.railHits > 0 && s.railHits < s.samples }) : choices[0].simulation.firstImpact!.objectSpeedAfter < choices[1].simulation.firstImpact!.objectSpeedAfter ? 0 : 1
  return <section className="lesson-comparison" aria-label="Lesson experiment">
    <h3>Unscored comparison</h3>
    <p>{scratch ? 'Which stroke carries the cue ball into a pocket after the object-ball contact?' : cushion ? 'Which stroke crosses the rebound boundary under small speed changes: some probes stop short, others hit the rail?' : 'At the same launch speed and nearly equal incoming speed, which contact sends less speed into the object ball?'}</p>
    <p className="lesson-comparison-note">{scratch || cushion ? 'Aim, pocket and spin stay fixed; pace changes.' : 'Both initial demonstrations use center ball at the same launch speed, with similar approach and object-ball distances. The thinner route uses a calibrated supplied aim, held fixed when pace is added.'} These demonstrations do not change your scored choice.</p>
    <div className="lesson-predictions" role="group" aria-label="Experiment prediction">{choices.map((v, index) => <Button key={v.label} size="sm" variant={prediction === index ? 'default' : 'outline'} disabled={busy || revealed} aria-pressed={prediction === index} onClick={() => { setPrediction(index); if (result) { setRetrying(false); setShown(true) } }}>{v.label} · {v.plan.speed.toFixed(2)} m/s</Button>)}</div>
    {!revealed && <Button variant="outline" size="sm" disabled={busy} onClick={() => { setShown(true); setRetrying(false) }}>Reveal comparison</Button>}
    {revealed && <div aria-live="polite">
      <p><strong>{prediction === null ? 'Inspect the measured comparison.' : prediction === correct ? 'Your prediction matches the simulation.' : 'Look again at the measured paths and speeds.'}</strong> {scratch ? 'Both strokes pot the target. The faster one scratches without an intervening cue-ball rebound. Read that post-contact line toward the pocket even when the pot looks attractive.' : cushion ? 'The five probes change only speed by −6%, −3%, 0%, +3% and +6%. Green dots show settled cue endpoints. These selected probes illustrate sensitivity; their counts are not probabilities or a guarantee about every error.' : 'The incoming speeds are measured immediately before first contact; outgoing speeds are measured after that physics step. The thinner contact leaves less speed in the object ball. The final demonstration changes only the thinner stroke’s launch pace to complete the pot.'}</p>
      {experiment.variants.map(variant => {
        const impact = variant.simulation.firstImpact
        const probe = speedProbeSummary(variant)
        return <figure key={variant.label}><figcaption><strong>{variant.label}</strong> · {variant.plan.speed.toFixed(2)} m/s</figcaption>
          <ExperimentDiagram prepared={prepared} variant={variant} />
          <dl className="geometry-measures">
            <div><dt>Object ball {variant.plan.ballId}</dt><dd>{variant.simulation.potted.includes(variant.plan.ballId) ? 'Potted' : 'Not potted'}</dd></div>
            <div><dt>Cue ball</dt><dd>{variant.simulation.scratch ? 'Scratch' : 'On table'}</dd></div>
            {cushion && <><div><dt>Probes with a rebound</dt><dd>{probe.railHits} / {probe.samples}</dd></div><div><dt>Largest safe endpoint shift</dt><dd>{probe.maxShift === null ? 'No safe stops' : `${(probe.maxShift * 100).toFixed(1)} cm`}</dd></div><div><dt>Safe settled probes</dt><dd>{probe.safeSamples} / {probe.samples}</dd></div></>}
            {!scratch && !cushion && impact && <>
              <div><dt>Geometric cut</dt><dd>{directShotGeometry(prepared.scenario, variant.plan).cutDegrees.toFixed(1)}°</dd></div>
              <div><dt>Cue speed before contact</dt><dd>{impact.cueSpeedBefore.toFixed(2)} m/s</dd></div>
              <div><dt>Cue speed after contact</dt><dd>{impact.cueSpeedAfter.toFixed(2)} m/s</dd></div>
              <div><dt>Object speed after contact</dt><dd>{impact.objectSpeedAfter.toFixed(2)} m/s</dd></div>
            </>}
          </dl>
        </figure>
      })}
      <p className="lesson-comparison-note">Cyan: cue path · Gold: object path · White rail rings: cue rebounds. Judge the complete scored strokes separately.</p>
      <Button variant="outline" size="sm" onClick={() => { setPrediction(null); setShown(false); setRetrying(Boolean(result)) }}>Try the prediction again</Button>
    </div>}
  </section>
}
