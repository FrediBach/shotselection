import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { ChevronLeft, ChevronRight, Info } from 'lucide-react'
import { POCKETS, TABLE } from '../engine/constants'
import type { LabResult, LabShotAnalysis } from '../engine/lab'
import type { Scenario, Vec2 } from '../engine/types'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from './ui/dialog'
import './LabResults.css'

interface Props {
  result: LabResult
  selectedId: string
  onSelect: (id: string) => void
  stale: boolean
}

const BALL_COLORS = ['#f4f1e7', '#e9b14e', '#6594d2', '#db7466', '#a68cce', '#e59857', '#71aa89', '#b7747d', '#787e79']
const ballColor = (id: number) => BALL_COLORS[id > 8 ? id - 8 : id] ?? '#c4c0a7'
const percent = (rate: number) => `${(rate * 100).toFixed(1)}%`
const points = (path: Vec2[]) => path.map(point => `${point.x},${point.y}`).join(' ')
const spread = (shot: LabShotAnalysis) => shot.sampleEnds.length ? `${(shot.spread * 100).toFixed(1)} cm` : 'n/a'

function EnsembleDiagram({ scenario, shot, showPaths, showEnds }: { scenario: Scenario; shot: LabShotAnalysis; showPaths: boolean; showEnds: boolean }) {
  const titleId = useId()
  const clipId = useId().replace(/:/g, '')
  return <svg className="lab-ensemble-table" viewBox="-.13 -.13 2.8 1.53" role="img" aria-labelledby={titleId}>
    <title id={titleId}>{shot.plan.label}: {shot.samples} simulated trials. Success {percent(shot.successRate)}, scratch {percent(shot.scratchRate)}. The solid lines show the intended stroke.</title>
    <defs><clipPath id={clipId}><rect x={-.06} y={-.06} width={TABLE.length + .12} height={TABLE.width + .12} /></clipPath></defs>
    <rect x={-.105} y={-.105} width={TABLE.length + .21} height={TABLE.width + .21} rx={.075} fill="#111a15" stroke="#695f43" strokeWidth={.012} />
    <rect x={-.04} y={-.04} width={TABLE.length + .08} height={TABLE.width + .08} rx={.02} fill="#39553c" />
    <rect width={TABLE.length} height={TABLE.width} fill="#48674b" />
    {POCKETS.map(pocket => <circle key={pocket.id} cx={pocket.position.x} cy={pocket.position.y} r={pocket.kind === 'corner' ? TABLE.cornerPocketRadius : TABLE.sidePocketRadius} fill="#0c110e" stroke={pocket.id === shot.plan.pocketId ? '#f4ce8a' : '#8c7a54'} strokeWidth={pocket.id === shot.plan.pocketId ? .013 : .006} />)}
    <g clipPath={`url(#${clipId})`} fill="none" strokeLinejoin="round">
      {showPaths && <>
        {shot.samplePaths.map((path, index) => <polyline key={`cue-${index}`} points={points(path)} stroke="#99e8ed" strokeOpacity={.14} strokeWidth={.005} />)}
        {shot.sampleObjectPaths.map((trial, index) => <polyline key={`object-${index}`} points={points(trial.path)} stroke={trial.outcome === 'pot' ? '#f2cc8c' : '#ed9786'} strokeOpacity={.23} strokeWidth={.005} />)}
      </>}
      {showEnds && shot.sampleBallEnds.flatMap((balls, index) => balls.filter(ball => !ball.pocketed).map(ball => <circle key={`${index}-${ball.id}`} cx={ball.position.x} cy={ball.position.y} r={.018} stroke={ballColor(ball.id)} strokeOpacity={.5} strokeWidth={.004} />))}
      <polyline points={points(shot.nominal.cuePath)} stroke="#c0f7fb" strokeWidth={.009} />
      <polyline points={points(shot.nominal.objectPath)} stroke="#f5cc86" strokeWidth={.009} />
      {!shot.nominal.scratch && <circle cx={shot.nominal.cueEnd.x} cy={shot.nominal.cueEnd.y} r={.031} stroke="#f4f1e7" strokeWidth={.006} />}
    </g>
    {scenario.balls.map(ball => <g key={ball.id} transform={`translate(${ball.position.x} ${ball.position.y})`}>
      <circle r={TABLE.ballRadius} fill={ballColor(ball.id)} stroke="#1b271d" strokeWidth={.003} />
      {ball.id !== 0 && <><circle r={TABLE.ballRadius * .6} fill="#f5f0df" /><text textAnchor="middle" dominantBaseline="central" fontFamily="Arial, sans-serif" fontSize={.027} fontWeight={700} fill="#25291f">{ball.id}</text></>}
    </g>)}
  </svg>
}

function OutcomeDetails({ shot }: { shot: LabShotAnalysis }) {
  const failures = [
    ['Ball not potted', shot.failures.misses],
    ['Wrong / no first contact', shot.failures.wrongContact],
    ['Wrong pocket', shot.failures.wrongPocket],
    ['Cue-ball scratch', shot.failures.scratch],
    ['Still moving at limit', shot.failures.unsettled],
  ] as const
  return <Dialog>
    <DialogTrigger asChild><Button type="button" variant="ghost" size="sm"><Info size={14} /> Outcome details</Button></DialogTrigger>
    <DialogContent className="lab-result-dialog" onKeyDown={event => event.stopPropagation()}>
      <DialogTitle>Outcome details</DialogTitle>
      <DialogDescription>{shot.plan.label} · {shot.samples} trials. Counts can overlap: a trial may have more than one failure.</DialogDescription>
      <dl className="lab-result-failures">{failures.map(([label, count]) => <div key={label}><dt>{label}</dt><dd>{count}<span> / {shot.samples}</span></dd></div>)}</dl>
      <div className="lab-result-stroke-details">
        <h3>Stroke used for this run</h3>
        <p>Ball {shot.plan.ballId} → {POCKETS.find(pocket => pocket.id === shot.plan.pocketId)?.name}<br />{shot.plan.speed.toFixed(2)} m/s · draw/follow {shot.plan.topSpin.toFixed(2)}<br />Sidespin {shot.plan.sideSpin.toFixed(1)} rad/s</p>
      </div>
      <div className="lab-result-metric-notes">
        <h3>Reading the results</h3>
        <p><strong>Success</strong> means contacting your chosen ball first, potting it in your chosen pocket, and settling without a scratch.</p>
        <p><strong>Pot</strong> counts the chosen pocket with correct first contact. A pot can still scratch or fail to settle.</p>
        <p><strong>Cue spread</strong> is the RMS distance from the mean finish among settled, non-scratch cue balls. It is n/a when there are none.</p>
        <p>Every option uses your player’s precision and the same seeded stroke errors for a paired comparison. These are simulated estimates; use more trials to investigate close differences.</p>
        <p>Solid lines show the intended stroke. Rings show trial finishes. Up to {shot.samplePaths.length} cue paths and {shot.sampleObjectPaths.length} object paths are displayed.</p>
      </div>
    </DialogContent>
  </Dialog>
}

export default function LabResults({ result, selectedId, onSelect, stale }: Props) {
  const [showPaths, setShowPaths] = useState(true)
  const [showEnds, setShowEnds] = useState(true)
  const inspector = useRef<HTMLDivElement>(null)
  const lastFocusedResult = useRef<LabResult | null>(null)
  const headingId = useId()
  const helpId = useId()
  const selectedIndex = Math.max(0, result.shots.findIndex(entry => entry.plan.id === selectedId))
  const shot = result.shots[selectedIndex]

  useEffect(() => {
    if (lastFocusedResult.current === result) return
    lastFocusedResult.current = result
    if (!stale && !document.activeElement?.closest('[role="dialog"]')) inspector.current?.focus({ preventScroll: true })
  }, [result, stale])

  function stepOption(direction: number) {
    const next = result.shots[(selectedIndex + direction + result.shots.length) % result.shots.length]
    if (next) onSelect(next.plan.id)
  }

  function navigateOptions(event: KeyboardEvent<HTMLElement>) {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || result.shots.length < 2) return
    const target = event.target as HTMLElement
    if (target.closest('input, select, textarea, [contenteditable]:not([contenteditable="false"]), [role="slider"], [role="spinbutton"]')) return
    const direction = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : 0
    if (!direction) return
    event.preventDefault()
    stepOption(direction)
  }

  if (!shot) return null
  return <section className="lab-result-panel" aria-labelledby={headingId} onKeyDown={navigateOptions}>
    <header className="lab-result-heading"><h2 id={headingId}>Results</h2><span className="lab-result-badge">{result.samples} trials / option</span></header>
    {stale && <p className="lab-result-stale" role="status">Results from the previous run. Run again to update.</p>}
    <div ref={inspector} className="lab-result-inspector" role="group" aria-label="Ensemble inspector" aria-describedby={helpId} aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown" tabIndex={0} onPointerDown={event => {
      if (event.button === 0 && (event.target as Element).closest('.lab-ensemble-table')) inspector.current?.focus({ preventScroll: true })
    }}>
      <div className="lab-result-inspection-heading">
        <div className="lab-result-navigation">
          <Button type="button" variant="outline" size="icon" aria-label="Previous play option" title="Previous option (← or ↑)" disabled={result.shots.length < 2} onClick={() => stepOption(-1)}><ChevronLeft size={16} aria-hidden="true" /></Button>
          <Button type="button" variant="outline" size="icon" aria-label="Next play option" title="Next option (→ or ↓)" disabled={result.shots.length < 2} onClick={() => stepOption(1)}><ChevronRight size={16} aria-hidden="true" /></Button>
          <h3><span>{selectedIndex + 1} / {result.shots.length}</span> {shot.plan.label}</h3>
        </div>
        <div className="lab-result-display-options"><label><input type="checkbox" checked={showPaths} onChange={event => setShowPaths(event.target.checked)} /> Trial paths</label><label><input type="checkbox" checked={showEnds} onChange={event => setShowEnds(event.target.checked)} /> Ball finishes</label></div>
      </div>
      <p id={helpId} className="lab-result-sr-only">Use left, right, up, or down arrow keys to step through options.</p>
      <div className="lab-inspection-stats" aria-live="polite" aria-atomic="true"><span className="lab-result-sr-only">Option {selectedIndex + 1} of {result.shots.length}, {shot.plan.label}. </span><span>Success <strong>{percent(shot.successRate)}</strong></span><span>Pot <strong>{percent(shot.potRate)}</strong></span><span>Scratch <strong>{percent(shot.scratchRate)}</strong></span><span>Cue spread <strong>{spread(shot)}</strong></span></div>
      <EnsembleDiagram scenario={result.scenario} shot={shot} showPaths={showPaths} showEnds={showEnds} />
    </div>
    <div className="lab-result-diagram-footer">
      <p className="lab-legend"><span><i className="lab-result-key-cue" /> Cue</span><span><i className="lab-result-key-object" /> Successful</span><span><i className="lab-result-key-miss" /> Failed</span><span>Solid: intended · Rings: finishes</span></p>
      <OutcomeDetails shot={shot} />
    </div>
    <div className="lab-result-comparison-heading"><h3>Compare options</h3><span>Select a row to inspect</span></div>
    <div className="lab-result-comparison-scroll"><table className="lab-result-comparison" aria-label="Lab comparison"><thead><tr><th scope="col">Option</th><th scope="col">Success</th><th scope="col">Pot</th><th scope="col">Scratch</th><th scope="col">Cue spread</th></tr></thead><tbody>{result.shots.map((entry, index) => <tr key={entry.plan.id} className={entry.plan.id === shot.plan.id ? 'lab-comparison-selected' : ''}>
      <th scope="row"><button type="button" aria-label={`Inspect ${entry.plan.label}`} aria-pressed={entry.plan.id === shot.plan.id} onClick={() => onSelect(entry.plan.id)}><span className="lab-result-option-number">{String(index + 1).padStart(2, '0')}</span><span>{entry.plan.label}<small>Ball {entry.plan.ballId} → {POCKETS.find(pocket => pocket.id === entry.plan.pocketId)?.name} · {entry.plan.speed.toFixed(2)} m/s</small></span></button></th>
      <td><strong>{percent(entry.successRate)}</strong></td><td>{percent(entry.potRate)}</td><td>{percent(entry.scratchRate)}</td><td>{spread(entry)}</td>
    </tr>)}</tbody></table></div>
  </section>
}
