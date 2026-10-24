import { useState } from 'react'
import { Button } from './ui/button'
import type { DrawDecayExperiment, PreparedRound, RoundAnalysis } from '@/engine/types'

function SpinDiagram({variant:v,scale}:{variant:DrawDecayExperiment['variants'][number];scale:number}) {
 const values=[v.launchRollSpeed,v.simulation.firstImpact!.cueRollSpeedBefore!]
 return <svg viewBox="0 0 360 120" role="img" aria-label={`${v.label}: launch and contact rotation, negative for backspin and positive for forward roll`}>
  <text x="95" y="16" textAnchor="middle" fontSize="12" fill="#ffb6ad">Backspin</text>
  <text x="265" y="16" textAnchor="middle" fontSize="12" fill="#9fe7b7">Forward rotation</text>
  <path d="M180 22 V105" stroke="white" strokeOpacity=".5" />
  {values.map((value,i)=><g key={i}>
   <rect x={value<0?180+value*scale:180} y={30+i*40} width={Math.abs(value)*scale} height="13" fill={value<0?'#ffb6ad':'#9fe7b7'} />
   <text x="180" y={57+i*40} textAnchor="middle" fontSize="12" fill="white">{i===0?'Launch':'Contact'}: {value.toFixed(2)} m/s</text>
  </g>)}
  <text x="180" y="117" textAnchor="middle" fontSize="10" fill="white">0 = no rotation along the approach</text>
 </svg>
}

export default function DrawDecayComparison({prepared,result,hidden,busy}:{prepared:PreparedRound;result:RoundAnalysis|null;hidden:boolean;busy:boolean}) {
 const [prediction,setPrediction]=useState<number|null>(null),[shown,setShown]=useState(false),[retry,setRetry]=useState(false)
 const variants=prepared.drawDecay!.variants, revealed=!retry&&(shown||Boolean(result))
 const scale=145/Math.max(...variants.flatMap(v=>[Math.abs(v.launchRollSpeed),Math.abs(v.simulation.firstImpact!.cueRollSpeedBefore!)]))
 return <section className="lesson-comparison" aria-label="Draw decay comparison" hidden={hidden}>
  <h3>Does the backspin reach the ball?</h3>
  <p>With the same launch speed and backspin, which approach needs more initial backspin to retain draw at contact?</p>
  <p className="lesson-comparison-note">This unscored experiment moves only the cue’s starting position along the same aim line. Object balls, pocket, cloth, launch speed and initial spin stay fixed in the first pair. The third demonstration changes only the long shot’s initial backspin. Your scored strokes remain separate.</p>
  <div className="lesson-predictions" role="group" aria-label="Draw prediction">{variants.slice(0,2).map((v,i)=><Button key={v.label} size="sm" variant={prediction===i?'default':'outline'} aria-pressed={prediction===i} disabled={busy||revealed} onClick={()=>{setPrediction(i);if(result){setRetry(false);setShown(true)}}}>{v.label} · {v.approach.toFixed(2)} m</Button>)}</div>
  {!revealed&&<Button size="sm" variant="outline" disabled={busy} onClick={()=>{setShown(true);setRetry(false)}}>Reveal comparison</Button>}
  {revealed&&<div aria-live="polite">
   <p><strong>{prediction===null?'Inspect the measured comparison.':prediction===1?'Your prediction matches the simulation.':'Compare launch spin with spin at contact.'}</strong> Cloth friction removes backspin during the approach. The short shot retains backspin; the matched long shot reaches contact with forward rotation. More initial backspin restores a negative contact value on that same long approach.</p>
   {variants.map(v=><figure key={v.label}><figcaption><strong>{v.label}</strong></figcaption>
    <SpinDiagram variant={v} scale={scale} />
    <dl className="geometry-measures">
     <div><dt>Approach distance</dt><dd>{v.approach.toFixed(2)} m</dd></div>
     <div><dt>Launch speed</dt><dd>{v.launchSpeed.toFixed(2)} m/s</dd></div>
     <div><dt>Speed at contact</dt><dd>{v.simulation.firstImpact!.cueSpeedBefore.toFixed(2)} m/s</dd></div>
     <div><dt>Backspin at contact</dt><dd>{v.simulation.firstImpact!.cueRollSpeedBefore!<0?'Retained':'Lost'}</dd></div>
     <div><dt>Opening pot</dt><dd>{v.simulation.potted.includes(v.plan.ballId)?'Made':'Missed'}</dd></div>
    </dl>
   </figure>)}
   <p className="lesson-comparison-note">Bars share one scale and show rotational surface speed along the incoming direction, measured just before contact. Negative means backspin; positive means forward rotation. Contact speed also changes with distance and friction. Retaining backspin does not guarantee a straight backward finish after a cut, or success on the scored position objective.</p>
   <Button size="sm" variant="outline" onClick={()=>{setPrediction(null);setShown(false);setRetry(Boolean(result))}}>Try the prediction again</Button>
  </div>}
  <p className="lesson-comparison-note">This practice check never blocks advancement.</p>
 </section>
}
