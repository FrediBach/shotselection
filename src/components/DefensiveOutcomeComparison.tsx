import { useState } from 'react'
import { Button } from './ui/button'
import SequenceDiagram from './SequenceDiagram'
import { defenseSummary, defenseWinner } from '../engine/defensive-outcome'
import type { PreparedRound, RoundAnalysis } from '../engine/types'
export default function DefensiveOutcomeComparison({ prepared, result, hidden, busy }: { prepared: PreparedRound; result: RoundAnalysis | null; hidden: boolean; busy: boolean }) {
  const [prediction, setPrediction] = useState<string | null>(null), [retry, setRetry] = useState(false), [inspected, setInspected] = useState(0)
  const [kind, setKind] = useState<'open' | 'screened'>('open'), [view, setView] = useState<'leave' | 'opener' | 'reply' | 'removal'>('leave')
  const options = prepared.defenseOptionIds!.map(id => prepared.balls[0].options.find(o => o.id === id)!), rule = prepared.scenario.defense!
  const shots = options.map(o => result?.candidates.find(s => s.plan.id === o.id)), summaries = shots.map(s => s ? defenseSummary(s.defenseTrials!, s.trialSuccesses!) : null)
  const answer = summaries[0] && summaries[1] ? defenseWinner(summaries[0], summaries[1]) : null, revealed = Boolean(result) && !retry
  const example = shots[inspected]?.defenseExamples?.[kind], actual = example?.opening.finalBalls.filter(b => !b.pocketed)
  const labels = { first: `Stroke ${options[0].label}`, second: `Stroke ${options[1].label}`, equal: 'Equal denial rate' }
  const ratio = (n: number, d: number) => d ? `${n}/${d} (${(n / d * 100).toFixed(1)}%)` : 'No eligible misses'
  const rows = [
    ['Legal opener pots', (s: NonNullable<typeof summaries[0]>) => ratio(s.counts.pot, s.total)],
    ['Complete pot + position', (s: NonNullable<typeof summaries[0]>) => ratio(s.completed, s.total)],
    ['Eligible clean misses', (s: NonNullable<typeof summaries[0]>) => `${s.misses}/${s.total}`],
    ['Proven direct reply after a miss', (s: NonNullable<typeof summaries[0]>) => ratio(s.counts.open, s.misses)],
    ['No permitted direct route', (s: NonNullable<typeof summaries[0]>) => ratio(s.denied, s.misses)],
    ['Of those: single-blocker screen proven', (s: NonNullable<typeof summaries[0]>) => String(s.counts.screened)],
    ['Of those: no single-blocker proof', (s: NonNullable<typeof summaries[0]>) => String(s.counts.limited)],
    ['Route exists, pot search unresolved', (s: NonNullable<typeof summaries[0]>) => String(s.counts.unproven)],
    ['Other / invalid outcomes', (s: NonNullable<typeof summaries[0]>) => String(s.counts.ineligible)],
    ['Assignment completed OR direct reply denied', (s: NonNullable<typeof summaries[0]>) => ratio(s.twoWay, s.total)],
  ] as const
  return <section className="lesson-comparison plant-quality-comparison" aria-label="Defensive miss comparison" hidden={hidden}>
    <h3>What does the opponent inherit?</h3>
    <p>Compare fixed strokes {options.map(o => o.label).join(' and ')}. Both complete the assignment nominally. Stroke {options[0].label} uses 5% less speed and 0.20 more draw than {options[1].label}; the pocket, aim, English and shared target stay fixed. Their attacking rates can be close, but their misses need not leave the same reply.</p>
    <p><strong>Opponent objective:</strong> after an eligible miss, pot ball {rule.ballId} directly from the actual leftover layout, with a cut no greater than {rule.maxCutAngle}°. The cue stays where it stops. An eligible miss must settle, avoid a scratch, contact ball {rule.ballId} first, pot no balls and have the cue ball or ball {rule.ballId} reach a cushion after contact. Other outcomes earn no defensive credit. Kicks and other target balls are outside this exercise.</p>
    <p>Which stroke more often denies a permitted direct route, among its eligible misses?</p>
    <div role="group" aria-label="Defensive prediction" className="lesson-predictions">{(Object.keys(labels) as (keyof typeof labels)[]).map(key => <Button key={key} size="sm" variant={prediction === key ? 'default' : 'outline'} aria-pressed={prediction === key} disabled={busy || revealed} onClick={() => setPrediction(key)}>{labels[key]}</Button>)}</div>
    {revealed && <>
      <p role="status">{answer && prediction === answer ? 'Your prediction matches. ' : ''}{answer === null ? 'There are not enough eligible misses to compare both rates.' : answer === 'equal' ? 'The sampled denial rates are equal.' : `${labels[answer]} denies a direct route more often in these sampled misses.`}</p>
      <table><caption>Attack and defensive leave · actual scoring trials</caption><thead><tr><th>Outcome</th>{options.map(o => <th key={o.id}>Stroke {o.label}</th>)}</tr></thead><tbody>{rows.map(([label, value], i) => <tr key={label} data-testid={`defense-row-${i}`}><th>{label}</th>{summaries.map((s, j) => <td key={j}>{value(s!)}</td>)}</tr>)}</tbody></table>
      <p>These denominators matter: direct-reply rates are conditional on eligible misses; the last row uses all trials. Complete assignments and denied replies are disjoint outcomes. An unresolved pot search is not counted as denial. No permitted route does not prove a physical screen: that label requires removing one blocker to restore a simulated pot, while the same stroke with it present hits the blocker first.</p>
      <div role="group" aria-label="Inspect defensive stroke" className="lesson-predictions">{options.map((o, i) => <Button key={o.id} size="sm" variant={inspected === i ? 'default' : 'outline'} aria-pressed={inspected === i} onClick={() => { setInspected(i); setKind(i === 1 && shots[i]?.defenseExamples?.screened ? 'screened' : 'open'); setView('leave') }}>Inspect stroke {o.label}</Button>)}</div>
      <div role="group" aria-label="Miss example" className="lesson-predictions">{(['open', 'screened'] as const).map(k => <Button key={k} size="sm" variant={kind === k ? 'default' : 'outline'} aria-pressed={kind === k} onClick={() => { setKind(k); setView('leave') }}>{k === 'open' ? 'Clear reply example' : 'Screened example'}</Button>)}</div>
      {example ? <>
        <p data-testid="defense-example">Stroke {options[inspected].label}, trial {example.index + 1}: {kind === 'open' ? `a ${example.reply.cutAngle.toFixed(1)}° direct cut has a simulated legal pot.` : `ball ${example.blockerId} screens the target. No direct route meets the cut limit; removing only this blocker restores a ${example.reply.cutAngle.toFixed(1)}° pot.`} This is the first verified example of this kind, not a typical-outcome or win-probability estimate.</p>
        <div role="group" aria-label="Defensive simulation view" className="lesson-predictions">{(['leave', 'opener', 'reply', ...(kind === 'screened' ? ['removal'] as const : [])] as const).map(v => <Button key={v} size="sm" variant={view === v ? 'default' : 'outline'} aria-pressed={view === v} onClick={() => setView(v)}>{v === 'leave' ? 'Actual leftover balls' : v === 'opener' ? 'Missed opener' : v === 'reply' ? kind === 'screened' ? 'Blocked reply' : 'Opponent pot' : 'Remove blocker'}</Button>)}</div>
        <figure><figcaption>{view === 'leave' ? 'Actual settled leave; nothing moved or respotted' : view === 'opener' ? 'Actual sampled opening miss' : view === 'removal' ? `Counterfactual: remove only ball ${example.blockerId}` : kind === 'screened' ? 'Same reply stroke with the blocker present' : 'Verified opponent reply from the actual leave'}</figcaption><SequenceDiagram balls={view === 'opener' ? prepared.scenario.balls : view === 'removal' ? example.reply.scenario.balls : actual!} simulation={view === 'leave' ? undefined : view === 'opener' ? example.opening : view === 'removal' || kind === 'open' ? example.reply.simulation : example.blockedReply} label="Defensive leave and reply simulation" /></figure>
      </> : <p>No verified {kind === 'open' ? 'clear-reply' : 'single-blocker screen'} example occurred for this stroke in these trials.</p>}
      <p>The additional defensive objective makes the consequence of a miss visible. Ordinary points still measure pot and position; the final table row is a separate training metric, not a replacement score or a prediction of who wins. The opponent proof uses a finite search for a nominal direct pot, without an opponent error ensemble. Real opponents can choose shots outside this exercise.</p>
      <Button size="sm" variant="outline" onClick={() => { setRetry(true); setPrediction(null); setInspected(0); setKind('open'); setView('leave') }}>Try the prediction again</Button>
    </>}
    {result && retry && <Button size="sm" onClick={() => setRetry(false)}>Check prediction</Button>}
    <p className="lesson-comparison-note">Predictions are optional and never block advancement.</p>
  </section>
}
