import { useState } from 'react'
import { Button } from './ui/button'
import { contactRollRatio, isStopContact, zoneMargin } from '@/engine/position-learning'
import { evaluateShotObjective } from '@/engine/objectives'
import { distance } from '@/engine/math'
import { POCKET_GEOMETRY } from '@/engine/table-geometry'
import type { PreparedRound, RoundAnalysis, ShotAnalysis } from '@/engine/types'

function PositionDiagram({ prepared, shot, margin }: { prepared: PreparedRound; shot: ShotAnalysis; margin: boolean }) {
  const { scenario } = prepared, sim = shot.nominal, zone = scenario.objective!
  const path = sim.cuePath.map(p=>`${p.x},${p.y}`).join(' ')
  return <svg viewBox="-.08 -.08 2.70 1.43" role="img" aria-label={margin ? `${shot.plan.label}: nominal finish and trial endpoints against the shared zone.` : `${shot.plan.label}: measured cue path with first contact marked.`}>
    <rect width="2.54" height="1.27" rx=".04" fill="#143f38" />
    {POCKET_GEOMETRY.map(p=><circle key={p.id} cx={p.center.x} cy={p.center.y} r=".045" fill="#071e1b" />)}
    <circle cx={zone.target!.x} cy={zone.target!.y} r={zone.radius} fill="#7de3ef" fillOpacity=".12" stroke="#7de3ef" strokeWidth=".01" />
    <polyline points={path} fill="none" stroke="#7de3ef" strokeWidth=".012" />
    {margin && shot.sampleBallEnds.map((balls,i)=>{
      const cue=balls.find(b=>b.id===0)!
      return <circle key={i} cx={cue.position.x} cy={cue.position.y} r=".012" fill={cue.pocketed ? '#ff9f98' : distance(cue.position,zone.target!)<=zone.radius ? '#9fe7b7' : '#ffc16e'} />
    })}
    {!margin && sim.firstImpact && <circle cx={sim.firstImpact.position.x} cy={sim.firstImpact.position.y} r=".045" fill="none" stroke="#ffc16e" strokeWidth=".012" />}
    {scenario.balls.map(ball=><g key={ball.id}><circle cx={ball.position.x} cy={ball.position.y} r=".029" fill={ball.id===0?'white':'#ffc16e'} /><text x={ball.position.x} y={ball.position.y-.05} textAnchor="middle" fontSize=".07" fill="white">{ball.id||''}</text></g>)}
    <circle cx={sim.cueEnd.x} cy={sim.cueEnd.y} r=".03" fill="none" stroke="white" strokeWidth=".012" />
  </svg>
}

export default function PositionLessonComparison({ prepared, result, busy, hidden }: { prepared: PreparedRound; result: RoundAnalysis | null; busy: boolean; hidden: boolean }) {
  const [prediction,setPrediction]=useState<string|null>(null)
  const [retrying,setRetrying]=useState(false)
  const margin=prepared.scenario.curriculum?.learning?.comparison==='zone-margin'
  const options=prepared.balls[0].options
  const shots=result ? options.map(o=>result.candidates.find(s=>s.plan.id===o.id)!) : []
  const legal=shots.filter(s=>evaluateShotObjective(prepared.scenario,s.plan,s.nominal).success)
  const center=legal.reduce<ShotAnalysis|null>((best,shot)=>!best || zoneMargin(prepared.scenario,shot.nominal)!>zoneMargin(prepared.scenario,best.nominal)! ? shot : best,null)
  const correct=margin ? center?.plan.id : shots.find(s=>isStopContact(prepared.scenario,s.plan,s.nominal))?.plan.id
  const revealed=Boolean(result)&&!retrying
  return <section className="lesson-comparison" aria-label="Position lesson comparison" hidden={hidden}>
    <h3>{margin?'Compare boundary margin':'Read the contact state'}</h3>
    <p>{margin?'Which stroke’s nominal finish has the most room before crossing the shared zone boundary?':'Which stroke arrives sliding with almost no forward or backward rotation, then stops close to this nearly full contact?'}</p>
    <div className="lesson-predictions" role="group" aria-label="Position prediction">{options.map(option=><Button key={option.id} size="sm" variant={prediction===option.id?'default':'outline'} aria-pressed={prediction===option.id} disabled={busy||revealed} onClick={()=>{setPrediction(option.id);setRetrying(false)}}>Stroke {option.label}</Button>)}</div>
    {revealed && <div aria-live="polite">
      <p><strong>{prediction===null?'Inspect the measured comparison.':prediction===correct?'Your prediction matches the measured result.':'Compare the contact state and finish again.'}</strong> {margin?'The central and near-edge finishes both pot the first ball and preserve a permitted next shot. Compare their geometric margins with the actual trial counts; more room alone does not guarantee a better whole stroke.':'A roll ratio near 0 means little longitudinal rotation while the cue ball slides. A ratio near 1 means natural forward roll; negative values mean backspin. Cloth changes this state during the approach.'}</p>
      {shots.map(shot=>{
        const impact=shot.nominal.firstImpact, ratio=contactRollRatio(shot.nominal)
        const objective=evaluateShotObjective(prepared.scenario,shot.plan,shot.nominal)
        return <figure key={shot.plan.id}>
          <figcaption><strong>{shot.plan.label}</strong> · {shot.plan.speed.toFixed(2)} m/s · launch spin {(shot.plan.topSpin*100).toFixed(0)}%</figcaption>
          <PositionDiagram prepared={prepared} shot={shot} margin={margin} />
          <dl className="geometry-measures">
            {margin ? <>
              <div><dt>Nominal boundary margin</dt><dd>{(zoneMargin(prepared.scenario,shot.nominal)!*100).toFixed(1)} cm</dd></div>
              <div><dt>Nominal complete objective</dt><dd>{objective.success?'Met':'Not met'}</dd></div>
              <div><dt>Safe, settled trials in zone</dt><dd>{Math.round(shot.positionRate*shot.samples)} / {shot.samples}</dd></div>
              <div><dt>Complete successful trials</dt><dd>{Math.round(shot.successRate*shot.samples)} / {shot.samples}</dd></div>
            </> : impact && <>
              <div><dt>Cue speed at contact</dt><dd>{impact.cueSpeedBefore.toFixed(2)} m/s</dd></div>
              <div><dt>Rotational surface speed</dt><dd>{impact.cueRollSpeedBefore!.toFixed(2)} m/s</dd></div>
              <div><dt>Roll ratio at contact</dt><dd>{ratio?.toFixed(2) ?? 'Unavailable'}</dd></div>
              <div><dt>Finish distance from contact</dt><dd>{(distance(impact.position,shot.nominal.cueEnd)*100).toFixed(1)} cm</dd></div>
            </>}
          </dl>
        </figure>
      })}
      <p className="lesson-comparison-note">{margin?'Green trial endpoints are inside the zone; gold are outside; red are scratches. The counts also require a safe, settled finish. Complete success additionally requires the pot and next-shot access. Negative margin means outside the zone.':'The gold ring marks first contact; the white ring marks the final cue position. Rotational surface speed is the signed rolling component along the cue’s direction, measured just before contact.'} These are complete strokes with different launch pace and spin, not a one-variable experiment.</p>
      <Button variant="outline" size="sm" onClick={()=>{setPrediction(null);setRetrying(true)}}>Try the prediction again</Button>
    </div>}
    <p className="lesson-comparison-note">This prediction never blocks advancement.</p>
  </section>
}
