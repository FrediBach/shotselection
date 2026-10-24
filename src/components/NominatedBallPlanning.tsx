import { Button } from './ui/button'
import { nominatedBallEvidence, NOMINATED_BALL_CUT_LIMIT } from '@/engine/nominated-ball'
import { directShotGeometry } from '@/engine/shot-geometry'
import { POCKET_GEOMETRY } from '@/engine/table-geometry'
import type { PreparedRound, RoundAnalysis } from '@/engine/types'

export default function NominatedBallPlanning({prepared,result,nominatedBallId,onNominate,busy}:{prepared:PreparedRound;result:RoundAnalysis|null;nominatedBallId:number|null;onNominate:(id:number)=>void;busy:boolean}) {
 const scenario=prepared.scenario,contrast=prepared.nextBallNominations?.find(c=>c.ballId===nominatedBallId)
 const selected=result&&nominatedBallId!==null?nominatedBallEvidence(scenario,result.selected.plan,result.selected.nominal,nominatedBallId):null
 const cue=result?.selected.nominal.finalBalls.find(b=>b.id===0&&!b.pocketed)
 const next=result?.selected.nominal.finalBalls.find(b=>b.id===nominatedBallId&&!b.pocketed)
 return <section className="lesson-comparison" aria-label="Nominated next ball">
  <h3>Which ball comes next?</h3>
  <p>Nominate a next ball, then choose a different opener. An easier opening cut can lose the connection to your nominated ball.</p>
  <div className="lesson-predictions" role="group" aria-label="Next ball nomination">{prepared.nextBallNominations?.map(c=><Button key={c.ballId} size="sm" variant={nominatedBallId===c.ballId?'default':'outline'} aria-pressed={nominatedBallId===c.ballId} disabled={busy||Boolean(result)} onClick={()=>onNominate(c.ballId)}>Next ball {c.ballId}</Button>)}</div>
  <p aria-live="polite"><strong>{nominatedBallId===null?'Nominate a next ball to continue.':`Reserved next ball: ${nominatedBallId}`}</strong> {!result&&'You can change the nomination before locking in the opener.'}</p>
  {result&&selected&&<>
   <p aria-live="polite"><strong>{selected.connectionMet?'Your opening pot preserves the nominated connection.':!selected.remaining?'The nominated ball was potted and cannot be played next.':!selected.legalPot?'The opening pot was not legal.':`The opening pot works, but no permitted route remains to ball ${nominatedBallId}.`}</strong></p>
   <svg viewBox="-.08 -.08 2.70 1.43" role="img" aria-label={`Actual chosen finish and next routes to nominated ball ${nominatedBallId}`}>
    <rect width="2.54" height="1.27" rx=".04" fill="#143f38" />
    {POCKET_GEOMETRY.map(p=><circle key={p.id} cx={p.center.x} cy={p.center.y} r=".045" fill="#071e1b" />)}
    {selected.routes.map(r=>{const pocket=POCKET_GEOMETRY.find(p=>p.id===r.pocketId)!;return <g key={r.pocketId}><path d={`M${cue!.position.x},${cue!.position.y} L${r.ghost.x},${r.ghost.y}`} stroke="#7de3ef" strokeWidth=".01" /><path d={`M${next!.position.x},${next!.position.y} L${pocket.center.x},${pocket.center.y}`} stroke="#ffc16e" strokeWidth=".01" /></g>})}
    {result.selected.nominal.finalBalls.filter(b=>!b.pocketed).map(b=><g key={b.id}><circle cx={b.position.x} cy={b.position.y} r={b.id===nominatedBallId?'.045':'.029'} fill={b.id===0?'white':b.id===nominatedBallId?'#d8b7ff':'#ffc16e'} /><text x={b.position.x} y={b.position.y-.06} textAnchor="middle" fontSize=".07" fill="white">{b.id||''}</text></g>)}
   </svg>
   <p className="lesson-comparison-note">Purple: nominated ball. Cyan/gold: its permitted next routes from the chosen finish. No line means no route meets the {NOMINATED_BALL_CUT_LIMIT}° cut limit and clearance checks. Other remaining balls still obstruct routes.</p>
   <h4>Compare the opening choices</h4>
   {result.candidates.filter(shot=>shot.plan.id===contrast?.lostId||shot.plan.id===contrast?.keptId).map(shot=>{
    const e=nominatedBallEvidence(scenario,shot.plan,shot.nominal,nominatedBallId!)
    return <div key={shot.plan.id} className="nomination-result">
     <strong>{shot.plan.label}</strong>{shot.plan.id===result.selected.plan.id?' · Your opener':''}
     {shot.plan.id===contrast?.lostId?' · Easier cut, lost connection':shot.plan.id===contrast?.keptId?' · Harder cut, preserved connection':''}
     <dl className="geometry-measures">
      <div><dt>Opening cut</dt><dd>{directShotGeometry(scenario,shot.plan).cutDegrees.toFixed(1)}°</dd></div>
      <div><dt>Legal opening pot</dt><dd>{e.legalPot?'Yes':'No'}</dd></div>
      <div><dt>Next ball remains</dt><dd>{e.remaining?'Yes':'No'}</dd></div>
      <div><dt>Next routes to ball {nominatedBallId}</dt><dd>{e.routes.length}</dd></div>
      <div><dt>Nominated connection</dt><dd>{e.connectionMet?'Preserved':'Lost'}</dd></div>
     </dl>
    </div>
   })}
   <details><summary>Inspect the other opening choices</summary>{result.candidates.filter(shot=>shot.plan.id!==contrast?.lostId&&shot.plan.id!==contrast?.keptId).map(shot=>{
    const e=nominatedBallEvidence(scenario,shot.plan,shot.nominal,nominatedBallId!)
    return <p key={shot.plan.id}><strong>{shot.plan.label}</strong> · {e.legalPot?'Legal pot':'Opening pot failed'} · {e.remaining?`${e.routes.length} next routes`:'Next ball potted'} · Connection {e.connectionMet?'preserved':'lost'}</p>
   })}</details>
   <p className="lesson-comparison-note">A smaller cut is one measure of opening difficulty, not a prediction of the best ensemble score. These checks use each stroke’s actual settled layout. Geometric access does not guarantee the next pot.</p>
  </>}
  <p className="lesson-comparison-note">The reserved ball cannot be chosen as the opener. The ordinary score compares the remaining opening choices; the nominated connection is a separate learning check. This round does not execute a second shot. A lost connection never blocks advancement.</p>
 </section>
}
