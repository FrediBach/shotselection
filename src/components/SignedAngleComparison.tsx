import { normalize, subtract } from '@/engine/math'
import { useState } from 'react'
import { Button } from './ui/button'
import { POCKET_GEOMETRY } from '@/engine/table-geometry'
import { pointsTowardPreview, signedAngleEvidence } from '@/engine/signed-angle'
import { evaluateShotObjective } from '@/engine/objectives'
import type { PreparedRound, RoundAnalysis, SignedAnglePreview } from '@/engine/types'

function SideDiagram({prepared,choice:c,revealed}:{prepared:PreparedRound;choice:SignedAnglePreview['choices'][number];revealed:boolean}) {
 const preview=prepared.signedAnglePreview!,zone=prepared.scenario.objective!,pocket=POCKET_GEOMETRY.find(p=>p.id===preview.pocketId)!
 const end={x:c.ghost.x+c.departure.x*.35,y:c.ghost.y+c.departure.y*.35}
 const incoming=normalize(subtract(c.ghost,c.cue)),outgoing=normalize(subtract(pocket.center,c.object)),r=.12
 const side={x:-c.departure.y*.035,y:c.departure.x*.035}
 return <svg viewBox="-.08 -.08 2.70 1.43" role="img" aria-label={`Stroke ${c.label}: signed next cut${revealed?' and ideal stun departure':''}`}>
  <rect width="2.54" height="1.27" rx=".04" fill="#143f38" />
  {POCKET_GEOMETRY.map(p=><circle key={p.id} cx={p.center.x} cy={p.center.y} r=".045" fill="#071e1b" />)}
  <circle cx={zone.target!.x} cy={zone.target!.y} r={zone.radius} fill="#7de3ef" fillOpacity=".1" stroke="#7de3ef" strokeWidth=".008" />
  <circle cx={preview.target.x} cy={preview.target.y} r={preview.radius} fill="#d8b7ff" fillOpacity=".15" stroke="#d8b7ff" strokeDasharray=".02 .01" strokeWidth=".01" />
  <text x={preview.target.x} y={preview.target.y-.12} textAnchor="middle" fontSize=".065" fill="#d8b7ff">For 3</text>
  <path d={`M${c.cue.x},${c.cue.y} L${c.ghost.x},${c.ghost.y}`} stroke="#7de3ef" strokeWidth=".012" />
  <path d={`M${c.ghost.x},${c.ghost.y} L${pocket.center.x},${pocket.center.y}`} stroke="#ffc16e" strokeWidth=".012" />
  <path d={`M${c.ghost.x},${c.ghost.y} l${incoming.x*.18},${incoming.y*.18}`} stroke="white" strokeDasharray=".015 .01" strokeWidth=".005" />
  <path d={`M${c.ghost.x+outgoing.x*r},${c.ghost.y+outgoing.y*r} A${r},${r} 0 0 ${c.angle>0?1:0} ${c.ghost.x+incoming.x*r},${c.ghost.y+incoming.y*r}`} fill="none" stroke="white" strokeWidth=".008" />
  {revealed&&<><path d={`M${c.ghost.x},${c.ghost.y} L${end.x},${end.y}`} stroke="#d8b7ff" strokeWidth=".018" /><path d={`M${end.x-c.departure.x*.06+side.x},${end.y-c.departure.y*.06+side.y} L${end.x},${end.y} L${end.x-c.departure.x*.06-side.x},${end.y-c.departure.y*.06-side.y}`} fill="none" stroke="#d8b7ff" strokeWidth=".018" /></>}
  <circle cx={c.ghost.x} cy={c.ghost.y} r=".029" fill="none" stroke="white" strokeWidth=".006" />
  <circle cx={c.cue.x} cy={c.cue.y} r=".029" fill="white" />
  <circle cx={c.object.x} cy={c.object.y} r=".029" fill="#ffc16e" />
  <text x={c.object.x} y={c.object.y-.05} textAnchor="middle" fontSize=".065" fill="white">2</text>
 </svg>
}

export default function SignedAngleComparison({prepared,result,hidden,busy}:{prepared:PreparedRound;result:RoundAnalysis|null;hidden:boolean;busy:boolean}) {
 const [prediction,setPrediction]=useState<string|null>(null),[shown,setShown]=useState(false),[retry,setRetry]=useState(false)
 const preview=prepared.signedAnglePreview!,revealed=!retry&&(shown||Boolean(result))
 const choices=preview.choices.map(c=>{
  const shot=result?.candidates.find(s=>s.plan.id===c.optionId)
  const evidence=shot?signedAngleEvidence(prepared.scenario,shot.nominal,preview.pocketId):null
  return {choice:evidence?{...c,...evidence,cue:shot!.nominal.cueEnd}:c,available:!result||Boolean(evidence),objective:shot?evaluateShotObjective(prepared.scenario,shot.plan,shot.nominal):null}
 })
 // Arrow length and the preview circle are not a simulated stopping point.
 const useful=(c:SignedAnglePreview['choices'][number])=>pointsTowardPreview(c,preview.target)
 const correct=choices.find(c=>c.available&&useful(c.choice))?.choice.optionId
 return <section className="lesson-comparison" aria-label="Signed angle comparison" hidden={hidden}>
  <h3>Choose the side for the next position</h3>
  <p>For the highlighted pocket, which finish gives an ideal stun departure toward the purple position preview for ball 3?</p>
  <p className="lesson-comparison-note">Both compared finishes are in the zone and have an allowed next cut. These are {result?'actual settled':'nominal predicted'} finishes. The purple circle is an unscored planning marker; ball 3 is not on the table.</p>
  <div className="lesson-predictions" role="group" aria-label="Side prediction">{preview.choices.map(c=><Button key={c.optionId} size="sm" variant={prediction===c.optionId?'default':'outline'} aria-pressed={prediction===c.optionId} disabled={busy||revealed} onClick={()=>{setPrediction(c.optionId);if(result){setShown(true);setRetry(false)}}}>Stroke {c.label}</Button>)}</div>
  {!revealed&&<Button size="sm" variant="outline" disabled={busy} onClick={()=>{setShown(true);setRetry(false)}}>Reveal departure directions</Button>}
  {revealed&&<p aria-live="polite"><strong>{prediction===null?'Inspect the two departure directions.':prediction===correct?'Your prediction selects the useful side.':'Both cuts are allowed; compare their departure sides.'}</strong> The sign distinguishes opposite sides of the object-to-pocket line. Under an ideal stun contact, the cue departs perpendicular to that line toward one side or the other.</p>}
  {choices.map(({choice:c,available,objective})=><figure key={c.optionId}><figcaption><strong>Stroke {c.label}</strong>{revealed&&available?useful(c)?' · Toward the preview':' · Away from the preview':''}</figcaption>
   <SideDiagram prepared={prepared} choice={c} revealed={revealed&&available} />
   <dl className="geometry-measures">
    <div><dt>Signed next cut</dt><dd>{available?`${c.angle>0?'+':''}${c.angle.toFixed(1)}°`:'Unavailable'}</dd></div>
    <div><dt>Inside the zone</dt><dd>{objective?(objective.positioned?'Yes':'No'):'Yes, nominally'}</dd></div>
    <div><dt>Cut within {prepared.scenario.objective!.maxCutAngle}°</dt><dd>{available?'Yes':'No'}</dd></div>
   </dl>
  </figure>)}
  <p className="lesson-comparison-note">Cyan: incoming cue line. Gold: object-to-pocket line. The white arc measures the turn to the dashed incoming-direction extension. In this top view, + is clockwise from gold to cyan’s incoming direction; − is counterclockwise. Purple arrows assume ideal stun contact (no forward or backward roll), without side-spin effects. They show departure direction, not a guaranteed landing point. Scoring still accepts either side and any permitted next pocket.</p>
  {revealed&&<Button size="sm" variant="outline" onClick={()=>{setPrediction(null);setShown(false);setRetry(Boolean(result))}}>Try the prediction again</Button>}
  <p className="lesson-comparison-note">This practice check never blocks advancement.</p>
 </section>
}
