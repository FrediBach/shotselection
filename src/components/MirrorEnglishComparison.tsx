import { useState } from 'react'
import { Button } from './ui/button'
import SequenceDiagram from './SequenceDiagram'
import { englishName } from '../engine/mirror-english'
import type { PreparedRound, RoundAnalysis } from '../engine/types'
export default function MirrorEnglishComparison({ prepared, result, hidden, busy }: { prepared: PreparedRound; result: RoundAnalysis | null; hidden: boolean; busy: boolean }) {
  const [prediction, setPrediction] = useState<string | null>(null), [retry, setRetry] = useState(false), [copied, setCopied] = useState(false)
  const e = prepared.mirrorEnglish!, reference = prepared.balls[0].options.find(o => o.id === e.referenceId)!
  const revealed = Boolean(result) && !retry, answer = englishName(e.reversed.plan.sideSpin), shown = copied ? e.copied : e.reversed
  return <section className="lesson-comparison plant-quality-comparison" aria-label="Mirrored English comparison" hidden={hidden}>
    <h3>Which English mirrors this route?</h3>
    <p>Reference stroke {reference.label} uses {englishName(e.original.plan.sideSpin).toLowerCase()} at {Math.abs(e.original.plan.sideSpin)} rad/s. Reflect the table left to right, including every ball, pocket, aim and landing zone. Keep speed ({e.original.plan.speed.toFixed(3)} m/s), longitudinal spin ({e.original.plan.topSpin.toFixed(2)}) and English magnitude fixed.</p>
    <figure><figcaption>Original reference route</figcaption><SequenceDiagram balls={prepared.scenario.balls} simulation={e.original.simulation} label="Original English route" zone={{ target: prepared.scenario.objective!.target!, radius: prepared.scenario.objective!.radius }} /></figure>
    <figure><figcaption>{revealed ? copied ? 'Mirrored layout · original sign copied' : 'Mirrored layout · sign reversed' : 'Mirrored layout · predict the spin'}</figcaption><SequenceDiagram balls={e.scenario.balls} simulation={revealed ? shown.simulation : undefined} label="Mirrored English route" zone={{ target: e.scenario.objective!.target!, radius: e.scenario.objective!.radius }} /></figure>
    <div role="group" aria-label="Mirrored spin prediction" className="lesson-predictions">{['Left English', 'Right English'].map(name => <Button key={name} size="sm" variant={prediction === name ? 'default' : 'outline'} aria-pressed={prediction === name} disabled={busy || revealed} onClick={() => setPrediction(name)}>{name}</Button>)}</div>
    {revealed && <>
      <p role="status">{prediction === answer ? 'Your prediction matches. ' : ''}{answer} reproduces the reflected route. Reverse the original sign.</p>
      <div role="group" aria-label="Mirrored route view" className="lesson-predictions"><Button size="sm" variant={!copied ? 'default' : 'outline'} aria-pressed={!copied} onClick={() => setCopied(false)}>Reversed sign</Button><Button size="sm" variant={copied ? 'default' : 'outline'} aria-pressed={copied} onClick={() => setCopied(true)}>Copied sign</Button></div>
      <p>The incoming cushion position, time and velocity match for both mirrored shots. Copying the sign changes the outgoing direction by {e.outgoingDifference.toFixed(1)}° and the final cue position by {(e.endpointDifference * 100).toFixed(1)} cm.</p>
      <table><caption>Actual mirrored outcomes</caption><thead><tr><th>Condition</th><th>Reversed sign</th><th>Copied sign</th></tr></thead><tbody>{(['legalPot', 'positioned', 'nextShotAvailable', 'success'] as const).map((key, i) => <tr key={key}><th>{['Legal pot', 'Landing zone', 'Next-shot access', 'Complete assignment'][i]}</th><td>{e.reversed.outcome[key] ? 'Yes' : 'No'}</td><td>{e.copied.outcome[key] ? 'Yes' : 'No'}</td></tr>)}</tbody></table>
      <p>A reflection reverses handedness; a half-turn rotation does not. Left and right English refer to the cue strike, not a fixed side of the screen. Reversing English reproduces the original route, including any original position failure; it does not guarantee the assignment succeeds.</p>
      <p>This comparison uses offered reference {reference.label}, regardless of your selected stroke. These nominal simulations explain the geometry; ordinary scoring still uses execution-error trials on the original layout.</p>
      <Button size="sm" variant="outline" onClick={() => { setRetry(true); setPrediction(null); setCopied(false) }}>Try the prediction again</Button>
    </>}
    {result && retry && <Button size="sm" onClick={() => setRetry(false)}>Check prediction</Button>}
    <p className="lesson-comparison-note">This prediction is optional and never blocks advancement.</p>
  </section>
}
