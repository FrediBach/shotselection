import { useState } from 'react'
import { Button } from './ui/button'
import { angleTrapEvidence, isOvershootPair, sampledCueTravel } from '@/engine/angle-trap'
import { evaluateShotObjective } from '@/engine/objectives'
import { normalize, subtract } from '@/engine/math'
import { POCKET_GEOMETRY } from '@/engine/table-geometry'
import type { PreparedRound, RoundAnalysis, ShotAnalysis } from '@/engine/types'

function AngleDiagram({ prepared, shot }: { prepared: PreparedRound; shot: ShotAnalysis }) {
 const {scenario}=prepared, sim=shot.nominal, objective=scenario.objective!, evidence=angleTrapEvidence(scenario,sim)
 const route=evidence.best, object=sim.finalBalls.find(b=>b.id===objective.nextBallId)!
 const pocket=route?POCKET_GEOMETRY.find(p=>p.id===route.pocketId)!:null
 const incoming=route?normalize(subtract(route.ghost,sim.cueEnd)):null
 const outgoing=route&&pocket?normalize(subtract(pocket.center,object.position)):null
 const start=incoming?Math.atan2(incoming.y,incoming.x):0
 const end=outgoing?Math.atan2(outgoing.y,outgoing.x):0
 const delta=Math.atan2(Math.sin(end-start),Math.cos(end-start)), r=.14
 return <svg viewBox="-.08 -.08 2.70 1.43" role="img" aria-label={`${shot.plan.label}: actual settled layout and smallest geometrically available next-shot cut.`}>
  <rect width="2.54" height="1.27" rx=".04" fill="#143f38" />
  {POCKET_GEOMETRY.map(p=><circle key={p.id} cx={p.center.x} cy={p.center.y} r=".045" fill="#071e1b" />)}
  <circle cx={objective.target!.x} cy={objective.target!.y} r={objective.radius} fill="#7de3ef" fillOpacity=".12" stroke="#7de3ef" strokeWidth=".01" />
  {scenario.curriculum?.learning?.comparison==='position-overshoot'&&<polyline points={sim.cuePath.map(p=>`${p.x},${p.y}`).join(' ')} fill="none" stroke="#d8b7ff" strokeWidth=".014" strokeDasharray=".025 .012" />}
  {route&&pocket&&incoming&&outgoing&&<>
   <path d={`M${sim.cueEnd.x},${sim.cueEnd.y} L${route.ghost.x},${route.ghost.y}`} fill="none" stroke="#7de3ef" strokeWidth=".012" />
   <path d={`M${route.ghost.x},${route.ghost.y} L${pocket.center.x},${pocket.center.y}`} fill="none" stroke="#ffc16e" strokeWidth=".012" />
   <path d={`M${route.ghost.x},${route.ghost.y} l${incoming.x*.24},${incoming.y*.24}`} stroke="white" strokeDasharray=".025 .015" strokeWidth=".007" />
   <path d={`M${route.ghost.x+incoming.x*r},${route.ghost.y+incoming.y*r} A${r},${r} 0 0 ${delta>0?1:0} ${route.ghost.x+outgoing.x*r},${route.ghost.y+outgoing.y*r}`} fill="none" stroke={evidence.permitted.length?'#9fe7b7':'#ff9f98'} strokeWidth=".012" />
   <circle cx={route.ghost.x} cy={route.ghost.y} r=".029" fill="none" stroke="white" strokeWidth=".007" />
  </>}
  {sim.finalBalls.filter(b=>!b.pocketed).map(ball=><g key={ball.id}><circle cx={ball.position.x} cy={ball.position.y} r=".029" fill={ball.id===0?'white':'#ffc16e'} /><text x={ball.position.x} y={ball.position.y-.055} textAnchor="middle" fontSize=".075" fill="white">{ball.id||''}</text></g>)}
 </svg>
}

export default function AngleTrapComparison({prepared,result,hidden,busy}:{prepared:PreparedRound;result:RoundAnalysis|null;hidden:boolean;busy:boolean}) {
 const [prediction,setPrediction]=useState<string|null>(null),[retry,setRetry]=useState(false)
 const overshoot=prepared.scenario.curriculum?.learning?.comparison==='position-overshoot'
 const matchesPair=(a:ShotAnalysis,b:ShotAnalysis)=>overshoot?isOvershootPair(a.nominal,b.nominal):angleTrapEvidence(prepared.scenario,b.nominal).distance!>angleTrapEvidence(prepared.scenario,a.nominal).distance!+.049
 const options=prepared.balls[0].options, revealed=Boolean(result)&&!retry
 const shots=result?options.map(o=>result.candidates.find(s=>s.plan.id===o.id)!):[]
 const trapped=shots.filter(s=>{const o=evaluateShotObjective(prepared.scenario,s.plan,s.nominal),e=angleTrapEvidence(prepared.scenario,s.nominal);return o.legalPot&&o.positioned&&!e.permitted.length&&Boolean(e.best)})
 const near=trapped.find(a=>shots.some(b=>evaluateShotObjective(prepared.scenario,b.plan,b.nominal).success
   && b.plan.pocketId===a.plan.pocketId && matchesPair(a,b)))
 const far=near?shots.find(b=>evaluateShotObjective(prepared.scenario,b.plan,b.nominal).success
   && b.plan.pocketId===near.plan.pocketId && matchesPair(near,b)):null
 return <section className="lesson-comparison" aria-label={overshoot?"Overshoot comparison":"Next-angle comparison"} hidden={hidden}>
  <h3>{overshoot?"Carry past the useful next angle":"Closer, but on the wrong angle"}</h3>
  <p>{overshoot?"Which stroke carries farther past contact, reaches the zone, but loses the next shot?":"Which stroke pots the 1 and reaches the zone, but leaves only next-shot cuts above this lesson’s limit?"} The next cut must stay within {prepared.scenario.objective!.maxCutAngle}°.</p>
  <div className="lesson-predictions" role="group" aria-label="Angle prediction">{options.map(o=><Button key={o.id} size="sm" variant={prediction===o.id?'default':'outline'} aria-pressed={prediction===o.id} disabled={busy||revealed} onClick={()=>{setPrediction(o.id);setRetry(false)}}>Stroke {o.label}</Button>)}</div>
  {revealed&&<div aria-live="polite">
   <p><strong>{prediction===null?'Inspect the two in-zone alternatives.':trapped.some(s=>s.plan.id===prediction)?'Your prediction identifies the angle trap.':'Check the zone and next angle separately.'}</strong> Both compared finishes are inside the same zone. {overshoot?"The longer cue route carries past a useful next angle; the shorter route preserves a permitted next shot.":"The nearer one has no route within the cut limit; the farther one preserves a permitted next shot."} A cut above the limit is not physically impossible—it fails this lesson’s rule.</p>
   {shots.map(shot=>{
    const e=angleTrapEvidence(prepared.scenario,shot.nominal),o=evaluateShotObjective(prepared.scenario,shot.plan,shot.nominal)
    return <figure key={shot.plan.id}><figcaption><strong>{shot.plan.label}</strong> · {shot===near?(overshoot?'Longer in-zone overshoot':'Nearer in-zone trap'):shot===far?(overshoot?'Shorter legal finish':'Farther legal finish'):'Other option'}</figcaption><AngleDiagram prepared={prepared} shot={shot} />
     <dl className="geometry-measures">
      {overshoot&&<div><dt>Legal opening pot</dt><dd>{o.legalPot?'Yes':'No'}</dd></div>}
      <div><dt>Inside the zone</dt><dd>{o.positioned?'Yes':'No'}</dd></div>
      {overshoot&&<div><dt>Cue route (sampled)</dt><dd>{sampledCueTravel(shot.nominal).toFixed(2)} m</dd></div>}
      <div><dt>Distance to ball 2</dt><dd>{e.distance===null?'Unavailable':`${e.distance.toFixed(2)} m`}</dd></div>
      <div><dt>Smallest open next cut</dt><dd>{e.best?`${e.best.cutAngle.toFixed(1)}°`:'No open route'}</dd></div>
      <div><dt>Routes within {prepared.scenario.objective!.maxCutAngle}°</dt><dd>{e.permitted.length}</dd></div>
      <div><dt>Complete objective</dt><dd>{o.success?'Met':'Not met'}</dd></div>
     </dl>
    </figure>
   })}
   <p className="lesson-comparison-note">These are actual settled positions. {overshoot&&"Purple dashes trace the traveled cue route. The compared strokes vary pace and spin; this is not a pace-only experiment. "}Cyan: cue approach to the next contact; gold: next object route; dashed white: continuation of the cue’s incoming direction. The arc shows their cut angle. Relaxing only the cut limit restores an open route from the trapped finish. Geometry does not guarantee a pot.</p>
   <Button size="sm" variant="outline" onClick={()=>{setPrediction(null);setRetry(true)}}>Try the prediction again</Button>
  </div>}
  <p className="lesson-comparison-note">This practice check never blocks advancement.</p>
 </section>
}
