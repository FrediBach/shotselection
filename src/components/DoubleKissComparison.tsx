import { useState } from 'react'
import { Button } from './ui/button'
import { POCKET_GEOMETRY } from '../engine/table-geometry'
import type { PreparedRound, RoundAnalysis } from '../engine/types'

export default function DoubleKissComparison({ prepared, result, hidden, busy }: { prepared: PreparedRound; result: RoundAnalysis | null; hidden: boolean; busy: boolean }) {
  const [prediction,setPrediction]=useState<number|null>(null),[retry,setRetry]=useState(false),[inspect,setInspect]=useState(0),[phase,setPhase]=useState(0)
  const data=prepared.doubleKiss
  if(!data)return null
  const revealed=Boolean(result)&&!retry, variant=data.variants[inspect]
  const encounter=variant.kiss ?? variant.closest
  const balls=phase===0?variant.rebound.balls:phase===1?encounter.balls!:variant.simulation.finalBalls
  const center=phase===1?encounter.balls!.find(b=>b.id===0)!.position:null
  return <section className="lesson-comparison plant-quality-comparison" aria-label="Second kiss comparison" hidden={hidden}>
    <h3>Keep the returning ball clear of the cue</h3>
    <p>These two practice strokes share the same aim, pocket and 2.50 m/s launch pace. One uses center ball; the other uses 105% topspin relative to natural rolling at launch. Which avoids a second cue/1 collision and pots the bank?</p>
    <div className="lesson-predictions" role="group" aria-label="Second kiss prediction">{['Center ball','Follow'].map((label,i)=><Button key={i} size="sm" variant={prediction===i?'default':'outline'} aria-pressed={prediction===i} disabled={busy||revealed} onClick={()=>setPrediction(i)}>{label}</Button>)}</div>
    <p>This optional practice pair is separate from the three scored strokes. Choose your scored bank stroke normally.</p>
    {revealed&&<>
      <p role="status">{prediction===0?'Your prediction matches. ':''}The center-ball practice pots without another cue/1 contact. The follow practice meets the returning 1 after its cushion rebound, deflects it and misses.</p>
      <div className="lesson-predictions" role="group" aria-label="Inspect bank practice">{['Center-ball practice','Follow practice'].map((label,i)=><Button key={i} size="sm" variant={inspect===i?'default':'outline'} aria-pressed={inspect===i} onClick={()=>{setInspect(i);setPhase(0)}}>{label}</Button>)}</div>
      <p data-testid="kiss-practice-timing">{phase===0?`Ball 1 rebounds at ${variant.rebound.time.toFixed(3)} s.`:phase===1?variant.kiss?`Unwanted second kiss at ${variant.kiss.time.toFixed(3)} s, ${(variant.kiss.time-variant.rebound.time).toFixed(3)} s after the cushion.`:`Sampled near pass at ${variant.closest.time.toFixed(3)} s: centers are ${(variant.closest.separation*100).toFixed(1)} cm apart.`:variant.success?'The center-ball practice completes the bank.':'The follow practice settles safely but ball 1 is not potted.'}</p>
      <svg viewBox={center?`${center.x-.35} ${center.y-.25} .7 .5`:'-.08 -.08 2.70 1.43'} role="img" aria-label="Second kiss practice evidence">
        <rect width="2.54" height="1.27" rx=".04" fill="#143f38" />
        {POCKET_GEOMETRY.map(p=><circle key={p.id} cx={p.center.x} cy={p.center.y} r=".045" fill="#071e1b" />)}
        {phase===2&&<><polyline data-testid="practice-cue-path" points={variant.simulation.cuePath.map(p=>`${p.x},${p.y}`).join(' ')} fill="none" stroke="#7de3ef" strokeWidth=".01" /><polyline data-testid="practice-object-path" points={variant.simulation.objectPath.map(p=>`${p.x},${p.y}`).join(' ')} fill="none" stroke="#ffc16e" strokeWidth=".012" /></>}
        {balls.filter(b=>!b.pocketed).map(ball=><g key={ball.id} data-testid={`practice-ball-${ball.id}`}><circle cx={ball.position.x} cy={ball.position.y} r=".029" fill={ball.id===0?'#fff':'#ffc16e'} /><text x={ball.position.x} y={ball.position.y+.014} textAnchor="middle" fontSize=".042" fill="#071e1b">{ball.id||'C'}</text>{phase===1&&variant.kiss&&<circle cx={ball.position.x} cy={ball.position.y} r=".042" fill="none" stroke="#ff9f98" strokeWidth=".006" />}</g>)}
      </svg>
      <div className="lesson-predictions" role="group" aria-label="Second kiss evidence phase">{['Cushion rebound','Return encounter','Settled paths'].map((label,i)=><Button key={i} size="sm" variant={phase===i?'default':'outline'} aria-pressed={phase===i} onClick={()=>setPhase(i)}>{label}</Button>)}</div>
      <p>{inspect===1?'In Return encounter, pink rings mark the recorded second cue/1 impact. Ball 1 changes direction at that impact; inspect the settled gold path to see the miss.':'The center-ball practice has no second cue/1 collision anywhere in the recorded simulation. The near-pass snapshot is the closest recorded frame after the cushion and before the pot, not an exact continuous clearance measurement.'}</p>
      <p>Follow changes the cue’s movement and the timing of the return encounter; it can also change delivery to the object ball. These are complete simulated outcomes at fixed launch pace and aim, not a claim that every miss is caused only by timing. Plan both balls’ movement so the bank’s return stays clear.</p>
      <p>Nominal practice outcomes are not success probabilities and do not change your scored trial results.</p>
      <Button size="sm" variant="outline" onClick={()=>{setRetry(true);setPrediction(null);setInspect(0);setPhase(0)}}>Try the prediction again</Button>
    </>}
    {result&&retry&&<Button size="sm" onClick={()=>setRetry(false)}>Check prediction</Button>}
    <p className="lesson-comparison-note">The prediction is optional and never blocks advancement.</p>
  </section>
}
