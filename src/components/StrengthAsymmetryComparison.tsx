import { useState } from 'react'
import { Button } from './ui/button'
import SequenceDiagram from './SequenceDiagram'
import { protectedDirection } from '../engine/strength-asymmetry'
import type { PreparedRound, RoundAnalysis } from '../engine/types'
const directions = { soft: 'Too soft', hard: 'Too hard', equal: 'Equal within resolution' }
export default function StrengthAsymmetryComparison({ prepared, result, hidden, busy }: { prepared: PreparedRound; result: RoundAnalysis | null; hidden: boolean; busy: boolean }) {
  const [variant, setVariant] = useState(0), [side, setSide] = useState(0), [passing, setPassing] = useState(false)
  const [predictions, setPredictions] = useState<Record<number, keyof typeof directions>>({}), [retry, setRetry] = useState(false)
  const evidence = prepared.strengthAsymmetry!, reference = prepared.balls[0].options.find(o => o.id === evidence.referenceId)!
  const current = evidence.variants[variant], boundary = current.sides[side], shown = passing ? boundary.passing : boundary.failing!
  const answer = protectedDirection(current.sides[0].value, current.sides[1].value), revealed = Boolean(result) && !retry
  const names = ['Slower variant', 'Faster variant']
  const signed = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(4)}%`
  const failed = boundary.failing ? [!boundary.failing.outcome.legalPot && 'legal pot', !boundary.failing.outcome.positioned && 'landing zone', !boundary.failing.outcome.nextShotAvailable && 'next-shot access'].filter(Boolean).join(' and ') : ''
  return <section className="lesson-comparison plant-quality-comparison" aria-label="Asymmetric strength comparison" hidden={hidden}>
    <h3>Which direction needs protection?</h3>
    <p>These two diagnostic pace variants come from offered stroke {reference.label}. Both complete the assignment nominally. Aim, spin, pocket and shared zone stay fixed; only speed changes. They are examples to inspect, separate from the three scored choices.</p>
    <div role="group" aria-label="Pace variant" className="lesson-predictions">{names.map((name, i) => <Button key={name} size="sm" variant={variant === i ? 'default' : 'outline'} aria-pressed={variant === i} onClick={() => { setVariant(i); setSide(0); setPassing(false) }}>{name}</Button>)}</div>
    <p>{names[variant]}: {current.plan.speed.toFixed(4)} m/s. Predict whether an unintended reduction or increase in this speed reaches failure sooner.</p>
    <div role="group" aria-label="Narrower margin prediction" className="lesson-predictions">{(Object.keys(directions) as (keyof typeof directions)[]).map(key => <Button key={key} size="sm" variant={predictions[variant] === key ? 'default' : 'outline'} aria-pressed={predictions[variant] === key} disabled={busy || revealed} onClick={() => setPredictions(p => ({ ...p, [variant]: key }))}>{directions[key]}</Button>)}</div>
    {revealed && <>
      <p role="status">{predictions[variant] === answer ? 'Your prediction matches. ' : ''}{answer === 'equal' ? 'The margins are equal within scan resolution.' : `Protect against ${answer === 'soft' ? 'too-soft' : 'too-hard'} errors: that sampled margin is narrower.`}</p>
      <table><caption>{names[variant]} · Separate speed margins</caption><thead><tr><th>Direction</th><th>Last pass</th><th>First fail</th></tr></thead><tbody>{current.sides.map((s, i) => <tr key={i} data-testid={`strength-margin-${i}`}><th>{i ? 'Too hard' : 'Too soft'}</th><td>{signed(s.passing.offset)}</td><td>{s.failing ? signed(s.failing.offset) : 'Limit reached'}</td></tr>)}</tbody></table>
      <p>Percentages are relative to this variant’s speed. These are directional margins for the whole assignment, not just potting and not a single total width.</p>
      <div role="group" aria-label="Boundary direction" className="lesson-predictions">{['Too soft boundary', 'Too hard boundary'].map((label, i) => <Button key={label} size="sm" variant={side === i ? 'default' : 'outline'} aria-pressed={side === i} onClick={() => { setSide(i); setPassing(false) }}>{label}</Button>)}</div>
      <div role="group" aria-label="Boundary simulation" className="lesson-predictions"><Button size="sm" variant={passing ? 'default' : 'outline'} aria-pressed={passing} onClick={() => setPassing(true)}>Last passing</Button><Button size="sm" variant={!passing ? 'default' : 'outline'} aria-pressed={!passing} onClick={() => setPassing(false)}>First failing</Button></div>
      <figure><figcaption>{passing ? 'Passing' : 'Failing'} probe · {signed(shown.offset)} · {shown.speed.toFixed(4)} m/s</figcaption><SequenceDiagram balls={prepared.scenario.balls} simulation={shown.simulation} zone={{ target: prepared.scenario.objective!.target!, radius: prepared.scenario.objective!.radius }} label="Actual speed-boundary simulation" /></figure>
      <table><caption>Observed boundary conditions</caption><thead><tr><th>Condition</th><th>Last pass</th><th>First fail</th></tr></thead><tbody>{(['legalPot', 'positioned', 'nextShotAvailable', 'success'] as const).map((key, i) => <tr key={key} data-testid={`strength-condition-${key}`}><th>{['Legal pot', 'Landing zone', 'Next-shot access', 'Complete assignment'][i]}</th><td>{boundary.passing.outcome[key] ? 'Yes' : 'No'}</td><td>{boundary.failing!.outcome[key] ? 'Yes' : 'No'}</td></tr>)}</tbody></table>
      <p data-testid="strength-failure">At this first failing probe, the unmet conditions are: {failed}. Conditions can fail together. Next-shot access is checked from the actual settled balls within the allowed cut angle, not inferred from the cue endpoint alone.</p>
      <p>Starting at each successful variant, the shared tolerance scanner steps outward by 1% and refines the first observed pass/fail bracket six times, to at most 0.015625 percentage points. Later successful regions do not widen this margin. Finite steps can miss small gaps; this does not prove every interior speed succeeds. The two displayed simulations verify the observed boundary, not a continuous threshold.</p>
      <p>{result?.selected.plan.id === reference.id ? `You selected reference stroke ${reference.label}.` : `You selected another stroke; these variants derive from reference ${reference.label}.`} These one-variable sensitivity probes are independent of player talents and are not success probabilities. The regular scoring trials still include all execution errors; your score is unchanged.</p>
      <Button size="sm" variant="outline" onClick={() => { setRetry(true); setPredictions({}); setVariant(0); setSide(0); setPassing(false) }}>Try the predictions again</Button>
    </>}
    {result && retry && <Button size="sm" onClick={() => setRetry(false)}>Check predictions</Button>}
    <p className="lesson-comparison-note">These predictions are optional and never block advancement.</p>
  </section>
}
