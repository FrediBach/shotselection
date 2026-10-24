import { useState } from 'react'
import { Button } from './ui/button'
import SequenceDiagram from './SequenceDiagram'
import type { PreparedRound, RoundAnalysis } from '../engine/types'

export default function LandingRecoveryComparison({ prepared, result, hidden, busy }: { prepared: PreparedRound; result: RoundAnalysis | null; hidden: boolean; busy: boolean }) {
  const [choices, setChoices] = useState<(number | null)[]>([null, null]), [retry, setRetry] = useState(false)
  const [inspect, setInspect] = useState(0), [view, setView] = useState<'leave' | 'opener' | 'adapted' | 'copied'>('leave')
  const data = prepared.landingRecovery
  if (!data) return null
  const revealed = Boolean(result) && !retry, leaf = data.leaves[inspect]
  const simulation = view === 'opener' ? leaf.first : view === 'adapted' ? leaf.second : view === 'copied' ? data.copied[inspect] : undefined
  const reference = prepared.balls[0].options.find(o => o.id === data.referenceId)!
  return <section className="lesson-comparison plant-quality-comparison" aria-label="Landing recovery comparison" hidden={hidden}>
    <h3>Read the landing, then choose the next stroke</h3>
    <p>These are two simulated landings from stroke {reference.label}, with 2% less and 3% more opening pace. Both legally pot the 1 and finish inside the same zone. Choose a response for each actual leave.</p>
    <div className="lesson-predictions" role="group" aria-label="Inspect landing">{data.leaves.map((_, i) => <Button key={i} size="sm" variant={inspect === i ? 'default' : 'outline'} aria-pressed={inspect === i} onClick={() => { setInspect(i); setView('leave') }}>Landing {i + 1}</Button>)}</div>
    <p>Landing {inspect + 1}: next cut {leaf.cut.toFixed(1)}°. The cue is at its actual settled position; every remaining ball is retained.</p>
    <SequenceDiagram balls={view === 'opener' ? prepared.scenario.balls : leaf.scenario.balls} simulation={simulation} zone={view === 'leave' || view === 'opener' ? { target: prepared.scenario.objective!.target!, radius: prepared.scenario.objective!.radius } : undefined} label={`Landing ${inspect + 1}: ${view}`} />
    <table><caption>Two candidate responses to ball 2</caption><thead><tr><th>Response</th><th>Aim</th><th>Speed</th><th>Topspin</th></tr></thead><tbody>{data.leaves.map((l, i) => <tr key={i}><th>{i + 1}</th><td>{(l.response.angle * 180 / Math.PI).toFixed(1)}°</td><td>{l.response.speed.toFixed(2)} m/s</td><td>{l.response.topSpin.toFixed(1)}</td></tr>)}</tbody></table>
    <p>Aim is measured from the table’s rightward axis. Both responses use zero side spin and the same pocket. Aim, pace and spin are complete stroke choices; cut angle alone does not determine difficulty.</p>
    {data.leaves.map((_, i) => <div key={i} className="lesson-predictions" role="group" aria-label={`Response for landing ${i + 1}`}><span>Landing {i + 1}:</span>{data.leaves.map((_, j) => <Button key={j} size="sm" variant={choices[i] === j ? 'default' : 'outline'} aria-pressed={choices[i] === j} disabled={busy || revealed} onClick={() => setChoices(previous => previous.map((value, index) => index === i ? j : value))}>Response {j + 1}</Button>)}</div>)}
    {revealed && <>
      <p role="status">{choices.every((choice, i) => choice === i) ? 'Both choices match. ' : ''}Landing 1 needs response 1; landing 2 needs response 2 among these candidates. Each adapted response pots the 2 without a scratch. Copying the other landing’s controls fails.</p>
      <div className="lesson-predictions" role="group" aria-label="Inspect recovery proof">{(['leave', 'opener', 'adapted', 'copied'] as const).map(mode => <Button key={mode} size="sm" variant={view === mode ? 'default' : 'outline'} aria-pressed={view === mode} onClick={() => setView(mode)}>{{ leave: 'Settled leave', opener: 'Opening path', adapted: 'Adapted response', copied: 'Copied response' }[mode]}</Button>)}</div>
      <p>{view === 'copied' ? 'This is the identical response from the other landing, played from this actual leave. It fails the nominated direct pot.' : view === 'adapted' ? 'This response legally pots ball 2 into its nominated pocket from this actual leave.' : 'The opening zone accepts both leaves, but their next-shot lines differ. Reassess the actual cue position before playing.'}</p>
      <p>These are deterministic practice examples, separate from your scored opener. They prove these responses, not that no other stroke could work or that either has a particular success probability.</p>
      <Button size="sm" variant="outline" onClick={() => { setRetry(true); setChoices([null, null]); setInspect(0); setView('leave') }}>Try the responses again</Button>
    </>}
    {result && retry && <Button size="sm" onClick={() => setRetry(false)}>Check responses</Button>}
    <p className="lesson-comparison-note">Both choices are optional and never block advancement.</p>
  </section>
}
