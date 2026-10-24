import { Button } from './ui/button'
import { POCKET_GEOMETRY } from '@/engine/table-geometry'
import { nextPocketEvidence } from '@/engine/next-pocket'
import type { PreparedRound, RoundAnalysis, ShotAnalysis } from '@/engine/types'

function PlanDiagram({prepared,pocketId,shot}:{prepared:PreparedRound;pocketId:number|null;shot?:ShotAnalysis}) {
 const scenario=prepared.scenario,objective=scenario.objective!,pocket=POCKET_GEOMETRY.find(p=>p.id===pocketId)
 const balls=shot?shot.nominal.finalBalls.filter(b=>!b.pocketed):scenario.balls.filter(b=>b.id!==objective.ballId)
 const object=balls.find(b=>b.id===objective.nextBallId),cue=balls.find(b=>b.id===0)
 const route=shot&&pocket?nextPocketEvidence(scenario,shot.plan,shot.nominal,pocket.id).intended:null
 return <svg viewBox="-.08 -.08 2.70 1.43" role="img" aria-label={shot?`${shot.plan.label}: actual finish and declared next pocket`:'Choose a numbered next pocket for ball 2'}>
  <rect width="2.54" height="1.27" rx=".04" fill="#143f38" />
  {POCKET_GEOMETRY.map(p=><g key={p.id}><circle cx={p.center.x} cy={p.center.y} r=".045" fill={p.id===pocketId?'#ffc16e':'#071e1b'} /><text x={p.center.x<.1?.09:p.center.x>2.4?2.45:p.center.x} y={p.center.y<.2?.11:1.16} textAnchor="middle" fontSize=".075" fill="white">{p.id+1}</text></g>)}
  {shot&&<circle cx={objective.target!.x} cy={objective.target!.y} r={objective.radius} stroke="#7de3ef" fill="#7de3ef" fillOpacity=".1" strokeWidth=".008" />}
  {object&&pocket&&<path d={`M${object.position.x},${object.position.y} L${pocket.center.x},${pocket.center.y}`} stroke="#ffc16e" strokeWidth=".012" strokeDasharray={route?undefined:'.03 .02'} />}
  {route&&cue&&<><path d={`M${cue.position.x},${cue.position.y} L${route.ghost.x},${route.ghost.y}`} stroke="#7de3ef" strokeWidth=".012" /><circle cx={route.ghost.x} cy={route.ghost.y} r=".029" stroke="white" strokeWidth=".006" fill="none" /></>}
  {balls.filter(b=>b.id!==0||shot).map(b=><g key={b.id}><circle cx={b.position.x} cy={b.position.y} r=".029" fill={b.id===0?'white':'#ffc16e'} /><text x={b.position.x} y={b.position.y-.05} textAnchor="middle" fontSize=".065" fill="white">{b.id||''}</text></g>)}
 </svg>
}

export default function NextPocketPlanning({prepared,result,pocketId,onChoose,busy}:{prepared:PreparedRound;result:RoundAnalysis|null;pocketId:number|null;onChoose:(id:number)=>void;busy:boolean}) {
 const pocket=POCKET_GEOMETRY.find(p=>p.id===pocketId)
 const selected=result&&pocket?nextPocketEvidence(prepared.scenario,result.selected.plan,result.selected.nominal,pocket.id):null
 return <section className="lesson-comparison" aria-label="Intended next pocket">
  <h3>Declare the pocket for ball 2</h3>
  <p>{result?'Your declared pocket stays fixed so you can verify the original plan.':'Choose a pocket before continuing to your opening stroke. You can revise it until you lock in the shot.'} Every pocket is selectable; some plans may be unavailable from all offered finishes.</p>
  <div className="lesson-predictions" role="group" aria-label="Next pocket choice">{POCKET_GEOMETRY.map(p=><Button key={p.id} size="sm" variant={p.id===pocketId?'default':'outline'} aria-pressed={p.id===pocketId} disabled={busy||Boolean(result)} onClick={()=>onChoose(p.id)}>{p.id+1} · {p.name}</Button>)}</div>
  <p aria-live="polite"><strong>{pocket?`Declared pocket: ${pocket.name}`:'Choose a next pocket to continue.'}</strong></p>
  {!result&&<><PlanDiagram prepared={prepared} pocketId={pocketId} /><p className="lesson-comparison-note">Planning view: ball 1 is removed and ball 2 stays at its starting position. The dashed gold line names the destination; it does not prove cue access.</p></>}
  {result&&pocket&&selected&&<>
   <p aria-live="polite"><strong>{selected.planMet?'Your declared plan is supported.':selected.intended?'The pocket route is available, but the full position plan failed.':'Your declared pocket is unavailable from the chosen finish.'}</strong> {selected.routes.length&&!selected.intended?'Another next pocket is available; it does not verify your declaration.':''}</p>
   {prepared.balls[0].options.map(option=>{
    const shot=result.candidates.find(s=>s.plan.id===option.id)!,e=nextPocketEvidence(prepared.scenario,shot.plan,shot.nominal,pocket.id)
    return <figure key={option.id}><figcaption><strong>Stroke {option.label}</strong>{shot.plan.id===result.selected.plan.id?' · Your opening stroke':''}</figcaption><PlanDiagram prepared={prepared} pocketId={pocket.id} shot={shot} />
     <dl className="geometry-measures">
      <div><dt>Legal opening pot</dt><dd>{e.objective.legalPot?'Yes':'No'}</dd></div>
      <div><dt>Inside the zone</dt><dd>{e.objective.positioned?'Yes':'No'}</dd></div>
      <div><dt>Any next pocket</dt><dd>{e.routes.length?'Available':'Unavailable'}</dd></div>
      <div><dt>Declared pocket</dt><dd>{e.intended?'Available':'Unavailable'}</dd></div>
      {e.intended&&<div><dt>Declared cut</dt><dd>{e.intended.cutAngle.toFixed(1)}°</dd></div>}
      <div><dt>Complete declared plan</dt><dd>{e.planMet?'Met':'Not met'}</dd></div>
     </dl>
     <p className="lesson-comparison-note">Available next pockets: {e.routes.length?e.routes.map(r=>POCKET_GEOMETRY.find(p=>p.id===r.pocketId)!.name).join(', '):'none'}.</p>
    </figure>
   })}
   <p className="lesson-comparison-note">Results use actual settled balls. Cyan shows access to the declared contact when available. A dashed gold line alone is only the intended direction. Route availability checks geometry and the cut limit; it does not guarantee the next pot.</p>
  </>}
  <p className="lesson-comparison-note">The pocket declaration is an unscored planning check. The regular score still accepts any permitted next pocket; a failed declaration never blocks advancement.</p>
 </section>
}
