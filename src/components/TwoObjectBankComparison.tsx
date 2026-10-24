import { useState } from 'react'
import { Button } from './ui/button'
import { twoObjectBankReplay } from '../engine/two-object-bank'
import { evaluateShotObjective } from '../engine/objectives'
import { POCKET_GEOMETRY } from '../engine/table-geometry'
import type { PreparedRound, RoundAnalysis } from '../engine/types'

export default function TwoObjectBankComparison({prepared,result,hidden}:{prepared:PreparedRound;result:RoundAnalysis|null;hidden:boolean}) {
  const [inspect,setInspect]=useState<string|null>(null),[phase,setPhase]=useState(0)
  const shot=result?.candidates.find(s=>s.plan.id===(inspect??result.selected.plan.id))
  const data=shot?twoObjectBankReplay(prepared.scenario,shot.nominal):null
  const rebound=data&&(phase===1||phase===2)?data.rebounds[phase-1]:null
  const balls=data?phase===0?data.contact.balls!:phase===4?shot!.nominal.finalBalls:rebound?rebound.balls:data.rebounds[1].balls:[]
  const shown=Math.min(phase,3)
  return <section className="lesson-comparison plant-quality-comparison" aria-label="Two cushion object bank replay" hidden={hidden}>
    <h3>Follow ball 1 through both cushions</h3>
    <p>The second object-ball rebound changes the final potting line and takes more speed out of the shot. Read both turns in order, then check the pace left for the pocket.</p>
    {!shot?<p>After committing your shot, inspect each recorded object-ball rebound.</p>:!data?<p role="status">The recorded two-cushion route is unavailable for this stroke.</p>:<>
      <div className="lesson-predictions" role="group" aria-label="Inspect two cushion stroke">{prepared.balls[0].options.map(o=><Button key={o.id} size="sm" variant={shot.plan.id===o.id?'default':'outline'} aria-pressed={shot.plan.id===o.id} onClick={()=>{setInspect(o.id);setPhase(0)}}>Stroke {o.label}</Button>)}</div>
      <p role="status">{phase===0?`Cue → ball 1 at ${data.contact.time.toFixed(3)} s.`:rebound?`Object rebound ${phase}: ball 1 at ${rebound.time.toFixed(3)} s.`:phase===3?'After the second cushion, ball 1 heads toward the nominated pocket.':`Settled result: ${evaluateShotObjective(prepared.scenario,shot.plan,shot.nominal).success?'the two-cushion bank succeeds':'the full trick does not succeed'}.`}</p>
      <svg viewBox={rebound?`${rebound.position.x-.35} ${rebound.position.y-.25} .7 .5`:'-.08 -.08 2.70 1.43'} role="img" aria-label="Two numbered object-ball rebounds">
        <rect width="2.54" height="1.27" rx=".04" fill="#143f38" />
        {POCKET_GEOMETRY.map(p=><circle key={p.id} cx={p.center.x} cy={p.center.y} r=".045" fill="#071e1b" />)}
        {data.segments.slice(0,shown).map((path,i)=><polyline key={i} data-testid={`two-bank-segment-${i}`} points={path.map(p=>`${p.x},${p.y}`).join(' ')} fill="none" stroke={['#ff9f98','#7de3ef','#ffc16e'][i]} strokeWidth=".012" strokeDasharray={i===0?'.025 .015':undefined} />)}
        {data.rebounds.slice(0,Math.min(phase,2)).map((e,i)=><g key={i} data-testid={`two-bank-rebound-${i}`}><circle cx={e.position.x} cy={e.position.y} r=".045" fill="none" stroke="#7de3ef" strokeWidth=".008" /><text x={e.position.x-.065} y={e.position.y-.045} fontSize=".05" fill="#fff">R{i+1}</text></g>)}
        {balls.filter(b=>!b.pocketed).map(ball=><g key={ball.id} data-testid={`two-bank-ball-${ball.id}`}><circle cx={ball.position.x} cy={ball.position.y} r=".029" fill={ball.id===0?'#fff':'#ffc16e'} /><text x={ball.position.x} y={ball.position.y+.014} textAnchor="middle" fontSize=".042" fill="#071e1b">{ball.id||'C'}</text></g>)}
      </svg>
      <div className="lesson-predictions" role="group" aria-label="Two cushion replay phase">{['Cue contact','First object rebound','Second object rebound','Complete bank route','Settled result'].map((label,i)=><Button key={i} size="sm" variant={phase===i?'default':'outline'} aria-pressed={phase===i} onClick={()=>setPhase(i)}>{label}</Button>)}</div>
      {phase>0&&<table><caption>Ball 1 speed at each revealed cushion</caption><thead><tr><th>Rebound</th><th>Before</th><th>After</th></tr></thead><tbody>{data.speeds.slice(0,Math.min(phase,2)).map((speed,i)=><tr key={i} data-testid={`two-bank-speed-${i}`}><th>{i+1}</th><td>{speed.before.toFixed(2)} m/s</td><td>{speed.after.toFixed(2)} m/s</td></tr>)}</tbody></table>}
      {phase>=2&&<p>The second rebound changes the object’s direction again. Its measured speed after that cushion is {data.speeds[1].after.toFixed(2)} m/s; it still has the final journey to the pocket ahead. Cushion losses and cloth drag both matter.</p>}
      <p>Pink dashes lead to R1; cyan connects R1 to R2; gold leaves R2 for the pocket. Markers are exact recorded rebound centers. Traces join recorded positions through both turns. Filled balls show the current contact snapshot or settled result.</p>
      <p>Both required rebounds belong to ball 1. These offered nominal strokes have no cue-cushion rebounds or second cue/object impacts. The full objective also requires the nominated pot and a safe finish.</p>
      <p>This nominal replay shows the route and measured speed changes. Use the ordinary trials to compare reliability under execution variation.</p>
    </>}
    <p className="lesson-comparison-note">The replay is optional and never blocks advancement.</p>
  </section>
}
