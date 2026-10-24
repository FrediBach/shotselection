import { useState } from 'react'
import { Button } from './ui/button'
import { POCKET_GEOMETRY } from '@/engine/table-geometry'
import { directNextShotRoutes } from '@/engine/objectives'
import type { PreparedRound, RoundAnalysis } from '@/engine/types'

export default function BackwardPlanning({ prepared, result, ready, onReady }: { prepared: PreparedRound; result: RoundAnalysis|null; ready: boolean; onReady:()=>void }) {
  const [prediction,setPrediction]=useState<string|null>(null)
  const [retrying,setRetrying]=useState(false)
  const plan=prepared.backwardPlan!, zone=prepared.scenario.objective!
  const pocket=POCKET_GEOMETRY.find(p=>p.id===plan.pocketId)!
  // Alternate labels with the authored seed; neither A nor B always means correct.
  const correct=prepared.scenario.seed%2===0?'A':'B'
  const points=correct==='A'?[plan.ghost,plan.opposite]:[plan.opposite,plan.ghost]
  const revealed=ready&&!retrying
  const reveal=(answer:string|null)=>{setPrediction(answer);setRetrying(false);onReady()}
  return <section className="lesson-comparison" aria-label="Backward planning">
    <h3>Start with the next contact</h3>
    <p>To send ball {zone.nextBallId} toward the highlighted {pocket.name} pocket, where should the cue-ball center be at contact: A or B?</p>
    <svg viewBox="-.08 -.08 2.70 1.43" role="img" aria-label="Next ball and highlighted pocket; the landing area appears after your prediction.">
      <rect width="2.54" height="1.27" rx=".04" fill="#143f38" />
      {POCKET_GEOMETRY.map(p=><circle key={p.id} cx={p.center.x} cy={p.center.y} r=".045" fill={p.id===plan.pocketId?'#ffc16e':'#071e1b'} />)}
      <path d={`M${plan.object.x},${plan.object.y} L${pocket.center.x},${pocket.center.y}`} stroke="#ffc16e" strokeWidth=".012" />
      <circle cx={plan.object.x} cy={plan.object.y} r=".029" fill="#ffc16e" />
      <text x={plan.object.x} y={plan.object.y-.06} fontSize=".08" fill="white" textAnchor="middle">{zone.nextBallId}</text>
      {revealed&&<>
        <circle cx={zone.target!.x} cy={zone.target!.y} r={zone.radius} fill="none" stroke="#7de3ef" strokeWidth=".01" />
        {plan.samples.map((s,i)=><circle key={i} cx={s.position.x} cy={s.position.y} r=".009" fill={s.compatible?'#9fe7b7':'#ff9f98'} />)}
        <path d={`M${zone.target!.x},${zone.target!.y} L${plan.ghost.x},${plan.ghost.y}`} stroke="#7de3ef" strokeWidth=".008" strokeDasharray=".025 .02" />
        <circle cx={plan.ghost.x} cy={plan.ghost.y} r=".029" stroke="white" fill="none" strokeWidth=".008" />
      </>}
    </svg>
    <svg viewBox={`${plan.object.x-.18} ${plan.object.y-.18} .36 .36`} className="contact-inset" role="img" aria-label="Magnified contact choices A and B on opposite sides of the object ball.">
      <circle cx={plan.object.x} cy={plan.object.y} r=".028575" fill="#ffc16e" />
      {points.map((point,i)=><g key={i}><circle cx={point.x} cy={point.y} r=".028575" stroke={revealed&&'AB'[i]===correct?'#9fe7b7':'white'} strokeWidth=".003" fill="none" /><text x={point.x} y={point.y+.009} fontSize=".025" fill="white" textAnchor="middle">{'AB'[i]}</text></g>)}
      <path d={`M${plan.object.x},${plan.object.y} l${(plan.opposite.x-plan.object.x)*2.5},${(plan.opposite.y-plan.object.y)*2.5}`} stroke="#ffc16e" strokeWidth=".003" />
    </svg>
    <p className="lesson-comparison-note">Magnified view: gold is the object ball; the gold line points toward the pocket. Outlined circles show possible cue-ball centers.</p>
    {!revealed?<><div className="lesson-predictions" role="group" aria-label="Contact prediction">{['A','B'].map(label=><Button key={label} size="sm" variant="outline" onClick={()=>reveal(label)}>Contact {label}</Button>)}</div><Button size="sm" variant="ghost" onClick={()=>reveal(null)}>Show the plan without answering</Button></>:<>
      <p aria-live="polite"><strong>{prediction===null?'Inspect the backward plan.':prediction===correct?`Your contact prediction ${prediction} is correct.`:`Use contact ${correct}, on the side away from the pocket.`}</strong> The cue approaches the outlined center behind the object ball. Green dots are sampled positions inside the scored zone that can reach this route within the {zone.maxCutAngle}° cut limit; red dots cannot.</p>
      <p>{result ? 'Compare the actual finishes with this plan.' : 'Now choose an opening stroke that reaches this area.'} This preview removes ball {zone.ballId} and assumes the other balls stay put. It checks geometry, not potting probability. The dashed line is a reference from the zone center, not an opening-shot prediction.</p>
      {result&&<div aria-label="Planned route results">{prepared.balls[0].options.map(option=>{
        const shot=result.candidates.find(s=>s.plan.id===option.id)!
        const route=directNextShotRoutes(prepared.scenario,shot.nominal).find(r=>r.pocketId===plan.pocketId)
        return <p key={option.id}><strong>Stroke {option.label}</strong> · {route?`Planned route available · ${route.cutAngle.toFixed(1)}° cut`:'Planned route unavailable from the actual finish'}</p>
      })}</div>}
      <p className="lesson-comparison-note">Scoring still accepts any permitted next pocket. This planning check never requires a correct answer.</p>
      <Button size="sm" variant="outline" onClick={()=>{setPrediction(null);setRetrying(true)}}>Try the contact prediction again</Button>
    </>}
  </section>
}
