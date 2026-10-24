import { useState } from 'react'
import { Button } from './ui/button'
import { contactAccessEvidence } from '@/engine/contact-access'
import { evaluateShotObjective } from '@/engine/objectives'
import { TABLE } from '@/engine/constants'
import type { PreparedRound, RoundAnalysis } from '@/engine/types'

function ClearanceDiagram({ evidence: e, label }: { evidence: NonNullable<ReturnType<typeof contactAccessEvidence>>; label: string }) {
 const xs=[e.cue.x,e.object.x,e.ghost.x],ys=[e.cue.y,e.object.y,e.ghost.y]
 const x=Math.min(...xs)-.09,y=Math.min(...ys)-.09,w=Math.max(...xs)-x+.09,h=Math.max(...ys)-y+.09
 return <svg viewBox={`${x} ${y} ${w} ${h}`} style={{maxHeight:260}} role="img" aria-label={`${label}: enlarged approach to the required contact center`}>
  <rect x={x} y={y} width={w} height={h} fill="#143f38" />
  <circle cx={e.object.x} cy={e.object.y} r={TABLE.ballDiameter} fill="#ff9f98" fillOpacity=".15" stroke="#ff9f98" strokeWidth=".002" strokeDasharray=".005 .004" />
  <path d={`M${e.object.x},${e.object.y} L${e.pocket.center.x},${e.pocket.center.y}`} stroke="#ffc16e" strokeWidth=".003" />
  <path d={`M${e.cue.x},${e.cue.y} L${e.ghost.x},${e.ghost.y}`} stroke={e.prematureContact?'#ff9f98':'#7de3ef'} strokeWidth=".003" />
  <circle cx={e.ghost.x} cy={e.ghost.y} r={TABLE.ballDiameter/2} fill="none" stroke="#7de3ef" strokeWidth=".002" />
  <circle cx={e.cue.x} cy={e.cue.y} r={TABLE.ballDiameter/2} fill="white" />
  <circle cx={e.object.x} cy={e.object.y} r={TABLE.ballDiameter/2} fill="#ffc16e" />
  <text x={e.object.x} y={e.object.y+.006} textAnchor="middle" fontSize=".018" fill="#071e1b">2</text>
  <circle cx={e.ghost.x} cy={e.ghost.y} r=".004" fill="#7de3ef" />
  {e.prematureContact&&<circle cx={e.firstTouch.x} cy={e.firstTouch.y} r=".005" fill="#ff9f98" stroke="white" strokeWidth=".001" />}
 </svg>
}

export default function ContactAccessComparison({prepared,result,hidden,busy}:{prepared:PreparedRound;result:RoundAnalysis|null;hidden:boolean;busy:boolean}) {
 const [prediction,setPrediction]=useState<string|null>(null),[retry,setRetry]=useState(false)
 const options=prepared.balls[0].options, revealed=Boolean(result)&&!retry
 const shots=result?options.map(o=>{const shot=result.candidates.find(s=>s.plan.id===o.id)!;return {shot,e:contactAccessEvidence(prepared.scenario,shot.nominal,prepared.contactAccessPocket!),o:evaluateShotObjective(prepared.scenario,shot.plan,shot.nominal)}}):[]
 const near=shots.find(s=>s.o.legalPot&&s.o.positioned&&s.e?.visible&&s.e.prematureContact)
 const far=near?shots.find(s=>s.o.success&&s.e?.permitted&&s.e.distance>near.e!.distance+.08&&s.shot.plan.pocketId===near.shot.plan.pocketId):undefined
 return <section className="lesson-comparison" aria-label="Contact clearance comparison" hidden={hidden}>
  <h3>Visible ball, unreachable contact</h3>
  <p>Which stroke reaches the zone but leaves the cue too close to approach the required contact on ball 2?</p>
  <div className="lesson-predictions" role="group" aria-label="Clearance prediction">{options.map(o=><Button key={o.id} size="sm" variant={prediction===o.id?'default':'outline'} aria-pressed={prediction===o.id} disabled={busy||revealed} onClick={()=>{setPrediction(o.id);setRetry(false)}}>Stroke {o.label}</Button>)}</div>
  {revealed&&<div aria-live="polite">
   <p><strong>{prediction===null?'Inspect the two in-zone alternatives.':prediction===near?.shot.plan.id?'Your prediction identifies the contact trap.':'Look for contact before the required cue center.'}</strong> The nearer finish can see ball 2, but the cue would hit it before reaching the required contact center. The farther finish leaves a clear approach to the same next pocket.</p>
   {shots.map(s=><figure key={s.shot.plan.id}><figcaption><strong>{s.shot.plan.label}</strong> · {s===near?'Nearer in-zone trap':s===far?'Farther legal finish':'Other option'}</figcaption>
    {s.e?<><ClearanceDiagram evidence={s.e} label={s.shot.plan.label} /><dl className="geometry-measures">
     <div><dt>Inside the zone</dt><dd>{s.o.positioned?'Yes':'No'}</dd></div>
     <div><dt>Distance to ball 2</dt><dd>{s.e.distance.toFixed(2)} m</dd></div>
     <div><dt>Ball center visible</dt><dd>{s.e.visible?'Yes':'No'}</dd></div>
     <div><dt>Hits before required contact</dt><dd>{s.e.prematureContact?'Yes':'No'}</dd></div>
     <div><dt>Next pocket</dt><dd>{s.e.pocket.name}</dd></div>
     <div><dt>Highlighted next route</dt><dd>{s.e.permitted?'Available':'Unavailable'}</dd></div>
     <div><dt>Complete objective</dt><dd>{s.o.success?'Met':'Not met'}</dd></div>
    </dl></>:<p>Contact evidence unavailable for this finish.</p>}
   </figure>)}
   <p className="lesson-comparison-note">Actual settled positions, enlarged independently. White: cue ball. Cyan ring: required cue position at contact. Gold line: direction toward the same next pocket in each diagram. The dashed red circle marks the minimum separation of the two ball centers, not the size of ball 2. A red dot marks premature contact. The close finish has no direct next route even with the cut limit relaxed. Scoring accepts any permitted next pocket.</p>
   <Button size="sm" variant="outline" onClick={()=>{setPrediction(null);setRetry(true)}}>Try the prediction again</Button>
  </div>}
  <p className="lesson-comparison-note">This practice check never blocks advancement.</p>
 </section>
}
