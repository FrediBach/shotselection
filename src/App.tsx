import { useEffect, useRef, useState } from 'react'
import { ArrowDownRight, ArrowRight, Check, ChevronRight, CircleHelp, Crosshair, Expand, Flag, FlaskConical, Focus, Layers3, LoaderCircle, MousePointer2, Play, RotateCcw, Sparkles, Target, Trophy, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import PoolTable from '@/components/PoolTable'
import { analyzeRoundAsync, generateScenario, recommendedTarget } from '@/engine'
import type { RoundAnalysis, ShotAnalysis, Vec2 } from '@/engine/types'

type Session = { level: number; score: number; rounds: number; perfect: number; seed: number }
const freshSession = (): Session => ({ level: 1, score: 0, rounds: 0, perfect: 0, seed: Math.floor(Math.random() * 1000000) })
function loadSession(): Session {
  try {
    const saved = JSON.parse(localStorage.getItem('shot-selection-session') || 'null')
    if (saved && Number.isInteger(saved.level) && saved.level > 0 && saved.level < 10000 && Number.isFinite(saved.score) && saved.score >= 0 && Number.isInteger(saved.rounds) && saved.rounds >= 0 && Number.isInteger(saved.perfect) && saved.perfect >= 0 && Number.isFinite(saved.seed)) return saved
  } catch { /* Storage is optional. */ }
  return freshSession()
}
const colors: Record<number, string> = { 1: '#e9b14e', 2: '#6594d2', 3: '#db7466', 4: '#a68cce', 5: '#e59857', 6: '#71aa89', 7: '#b7747d', 8: '#787e79' }
const percent = (value: number) => `${Math.round(value * 100)}%`
function BallIcon({ id, small = false }: { id: number; small?: boolean }) {
  return <span className={`ball-icon ${small ? 'ball-small' : ''}`} style={{ '--ball-color': colors[id] || '#939f8b' } as React.CSSProperties}><span>{id}</span></span>
}

export default function App() {
  const [session, setSession] = useState<Session>(loadSession)
  const [scenario, setScenario] = useState(() => generateScenario(session.level, session.seed + session.level * 919))
  const [selectedBall, setSelectedBall] = useState<number | null>(null)
  const [target, setTarget] = useState<Vec2 | null>(null)
  const [result, setResult] = useState<RoundAnalysis | null>(null)
  const [inspected, setInspected] = useState<ShotAnalysis | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [showEnsemble, setShowEnsemble] = useState(true)
  const [playing, setPlaying] = useState(false)
  const [playbackKey, setPlaybackKey] = useState(0)
  const [view, setView] = useState<'table' | 'top'>('table')
  const [modal, setModal] = useState<'help' | 'physics' | 'stats' | 'reset' | null>(null)
  const verdictHeading = useRef<HTMLHeadingElement>(null)
  const request = useRef(0)
  const analysisController = useRef<AbortController | null>(null)
  useEffect(() => () => { request.current += 1; analysisController.current?.abort() }, [])
  useEffect(() => { try { localStorage.setItem('shot-selection-session', JSON.stringify(session)) } catch { /* Browser storage can be unavailable. */ } }, [session])
  useEffect(() => { if (result) verdictHeading.current?.focus() }, [result])
  const objectBalls = scenario.balls.filter(ball => ball.id > 0)
  const difficulty = scenario.level <= 3 ? 'Fundamentals' : scenario.level <= 7 ? 'Position play' : 'Precision play'
  const step = result ? 3 : selectedBall === null ? 1 : target === null ? 2 : 3
  const selectBall = (id: number) => { if (!busy && !result) { setSelectedBall(id); setError('') } }
  const selectTarget = (point: Vec2) => { if (!busy && !result) { setTarget(point); setError('') } }
  function clearRound(next: Session) {
    request.current += 1
    analysisController.current?.abort()
    setSession(next); setScenario(generateScenario(next.level, next.seed + next.level * 919)); setSelectedBall(null); setTarget(null)
    setResult(null); setInspected(null); setBusy(false); setPlaying(false); setError('')
  }
  async function submit() {
    if (selectedBall === null || !target || busy || result) return
    const id = ++request.current
    analysisController.current = new AbortController()
    setBusy(true); setError('')
    try {
      const analysis = await analyzeRoundAsync(scenario, { ballId: selectedBall, target }, { samples: 64, signal: analysisController.current.signal })
      if (id !== request.current) return
      setResult(analysis); setInspected(analysis.selected)
      // Persist the next unplayed level, so reloading cannot score this round twice.
      setSession(previous => ({ ...previous, level: scenario.level + 1, rounds: previous.rounds + 1, score: previous.score + analysis.points, perfect: previous.perfect + Number(analysis.points === 1) }))
    } catch (cause) {
      if (id === request.current) setError(cause instanceof Error ? cause.message : 'The simulation could not finish. Please try again.')
    } finally { if (id === request.current) setBusy(false) }
  }
  function playShot(shot: ShotAnalysis) { setInspected(shot); setPlaying(true); setPlaybackKey(previous => previous + 1) }

  return <div className="app-shell">
    <header className="site-header">
      <a className="brand" href="/" aria-label="Shot Selection home"><span className="brand-mark"><span /></span><span>shot<span className="brand-light">selection</span><span className="brand-period">.</span></span></a>
      <nav className="main-nav" aria-label="Main navigation"><button className="nav-active" onClick={() => setModal(null)}>The game</button><button onClick={() => setModal('help')}>How to play <ArrowDownRight size={13} /></button><button onClick={() => setModal('physics')}>Behind the physics</button></nav>
      <button className="session-score" onClick={() => setModal('stats')} aria-label={`View session stats, ${session.score} points`}><Trophy size={15} /><span>{session.score.toFixed(1)} <span className="muted">pts</span></span><span className="score-divider" /><span className="session-label">This session</span><ChevronRight size={14} /></button>
    </header>

    <main>
      <section className="intro"><div><div className="eyebrow"><span className="live-dot" /> A GAME OF PROBABILITY & POSITION</div><h1>Good players make shots.<br className="mobile-break" /> <span>Great players choose them.</span></h1><p>Read the table. Find the forgiving shot. Let the physics do the talking.</p></div><button className="how-link" aria-label="How to play" onClick={() => setModal('help')}><CircleHelp size={16} /><span>First time here?</span></button></section>
      <div className="game-layout">
        <section className="table-panel" aria-label="Interactive pool table">
          <div className="table-toolbar"><div className="level-label"><span className="level-number">{String(scenario.level).padStart(2, '0')}</span><div><div className="toolbar-title">{difficulty}</div><div className="toolbar-caption">LEVEL {String(scenario.level).padStart(2, '0')} <span>·</span> {objectBalls.length} OBJECT BALLS</div></div></div><div className="table-actions"><span className="table-size">9 FT <span>TOURNAMENT TABLE</span></span><Button variant="ghost" size="icon" aria-label={view === 'table' ? 'Switch to overhead view' : 'Switch to angled view'} title="Change camera view" onClick={() => setView(view === 'table' ? 'top' : 'table')}><Expand size={17} /></Button><Button variant="ghost" size="icon" aria-label="Restart session" title="Restart session" onClick={() => setModal('reset')} disabled={busy}><RotateCcw size={16} /></Button></div></div>
          <div className="table-stage">
            <div className="table-instruction"><span className={result ? 'instruction-dot complete' : 'instruction-dot'} />{playing ? 'Playing the simulated shot' : result ? 'Explore the paths. Find the pattern.' : selectedBall === null ? 'Start by selecting an object ball' : target === null ? 'Click the cloth to place your cue-ball finish' : 'Your call. Ready when you are.'}</div>
            <div className="pool-canvas"><PoolTable scenario={scenario} selectedBall={result ? inspected?.plan.ballId ?? selectedBall : selectedBall} target={result ? inspected?.plan.target || target : target} onSelectBall={selectBall} onSelectTarget={selectTarget} analysis={inspected} showEnsemble={Boolean(result) && showEnsemble} playing={playing} playbackKey={playbackKey} onPlaybackEnd={() => setPlaying(false)} view={view} interactive={!busy && !result} /></div>
            <div className="table-watermark">SHOT SELECTION <span>EST. 2026</span></div>
            {busy && <div className="simulation-overlay" role="status"><LoaderCircle className="spin" size={25} /><strong>Finding the margin for error</strong><span>Simulating small variations in every shot…</span></div>}
          </div>
          <div className="table-footer"><div className="table-legend"><span><i className="legend-cue" /> Cue ball</span><span><i className="legend-target" /> Desired finish</span>{result && <span><i className="legend-path" /> Ensemble paths</span>}</div><span className="interactive-hint"><MousePointer2 size={13} /> {result ? 'Select a shot below to inspect' : 'Click a ball, then a position'}</span></div>
        </section>

        <aside className="shot-panel">
          <div className="shot-panel-heading"><span className="eyebrow">{result ? 'THE VERDICT' : 'YOUR NEXT MOVE'}</span><span className="tiny-pill">{result ? 'ROUND COMPLETE' : 'SOLO PLAY'}</span></div>
          {result ? <>
            <div className={`verdict-icon ${result.points === 0 ? 'verdict-low' : ''}`}>{result.points === 1 ? <Trophy size={25} /> : result.points === 0.5 ? <Target size={25} /> : <Layers3 size={25} />}</div>
            <h2 ref={verdictHeading} tabIndex={-1}>{result.best.successRate === 0 ? 'A difficult table.' : result.points === 1 ? 'That’s the smart shot.' : result.points === 0.5 ? 'A very close call.' : 'There’s a safer way.'}</h2>
            <p className="panel-description">{result.best.successRate === 0 ? 'None of the sampled shots found a reliable pot and finish. Explore the paths, then try the next layout.' : result.points === 1 ? 'Your choice gave you the strongest margin for error.' : result.points === 0.5 ? 'Your shot was within reach of the most reliable option.' : 'A different ball or finish position offers more room for error.'}</p>
            <div className="points-awarded"><span>Points this round</span><strong>+{result.points.toFixed(1)} <span>pts</span></strong></div>
            <div className="result-comparison"><div><span>Your shot</span><strong>{percent(result.selected.successRate)}</strong></div><div><span>Best shot <BallIcon id={result.best.plan.ballId} small /></span><strong>{percent(result.best.successRate)}</strong></div><p>Pot + safe finish, within {Math.round(result.positionTolerance * 100)} cm of the target.</p></div>
            <Button className="full-width" onClick={() => playShot(result.best)} disabled={playing}><Play size={16} fill="currentColor" /> {playing ? 'Shot in motion…' : 'Play the best shot'}</Button>
            <Button className="full-width next-level" variant="outline" onClick={() => clearRound(session)}>Next level <ArrowRight size={16} /></Button>
          </> : <>
            <h2>Make your call.</h2><p className="panel-description">The best shot isn’t the most impressive.<br />It’s the one you can make again.</p>
            <div className={`choice-step ${selectedBall !== null ? 'step-complete' : ''}`}><span className="step-number">{selectedBall !== null ? <Check size={12} /> : '1'}</span><div><h3>Choose your object ball</h3><p>Which ball would you pocket?</p></div></div>
            <div className="ball-choices">{objectBalls.map(ball => <button key={ball.id} className={`ball-choice ${selectedBall === ball.id ? 'selected' : ''}`} onClick={() => selectBall(ball.id)} disabled={busy} aria-pressed={selectedBall === ball.id} aria-label={`Select ball ${ball.id}`}><BallIcon id={ball.id} /><span>Ball {ball.id}</span>{selectedBall === ball.id && <span className="ball-check"><Check size={10} /></span>}</button>)}</div>
            <div className={`choice-step position-step ${target ? 'step-complete' : ''}`}><span className="step-number">{target ? <Check size={12} /> : '2'}</span><div><h3>Leave yourself in position</h3><p>Where should the cue ball finish?</p></div></div>
            <button className={`position-choice ${target ? 'position-set' : ''}`} onClick={() => { if (selectedBall !== null) selectTarget(recommendedTarget(scenario, selectedBall)) }} disabled={selectedBall === null || busy} aria-label="Set a natural cue-ball finish"><Crosshair size={23} /><span><strong>{target ? 'Finish position set' : 'Pick a spot on the table'}</strong><span>{target ? `${(target.x * 100).toFixed(0)} cm across · ${(target.y * 100).toFixed(0)} cm down` : 'Or click here for a natural finish'}</span></span>{target && <Check size={15} />}</button>
            <div className="position-presets" aria-label="Cue-ball finish presets"><span>Try a zone</span>{[{ label: 'Left', x: 0.64 }, { label: 'Center', x: 1.27 }, { label: 'Right', x: 1.9 }].map(preset => <button key={preset.label} disabled={selectedBall === null || busy} onClick={() => selectTarget({ x: preset.x, y: 0.635 })}>{preset.label}</button>)}{target && <button className="clear-target" disabled={busy} aria-label="Clear finish position" onClick={() => setTarget(null)}><X size={12} /></button>}</div>
            {selectedBall !== null && <details className="position-details"><summary>Fine-tune position</summary><div>{(['x', 'y'] as const).map(axis => <label key={axis}>{axis === 'x' ? 'Across' : 'Down'} <span>cm</span><input type="number" aria-label={`Finish ${axis === 'x' ? 'across' : 'down'} in centimeters`} min="3" max={axis === 'x' ? 251 : 124} step="1" disabled={busy} value={Math.round((target?.[axis] ?? (axis === 'x' ? 1.27 : 0.635)) * 100)} onChange={event => { const value = Number(event.target.value); if (Number.isFinite(value)) selectTarget({ ...(target ?? { x: 1.27, y: 0.635 }), [axis]: Math.min(axis === 'x' ? 2.51 : 1.24, Math.max(0.03, value / 100)) }) }} /></label>)}</div></details>}
            <div className="decision-note"><Sparkles size={16} /><p>A little less risk.<br /><strong>A lot more consistency.</strong></p></div>
            {error && <p role="alert" className="error-message">{error}</p>}
            <Button className="lock-button full-width" onClick={submit} disabled={step < 3 || busy}>{busy ? <><LoaderCircle size={17} className="spin" /> Running ensemble…</> : <>Lock in your shot <ArrowRight size={17} /></>}</Button>
            <p className="lock-caption">{busy ? 'Your table stays responsive while we calculate.' : 'Choose first. See the probabilities after.'}</p>
          </>}
        </aside>
      </div>

      {result ? <section className="ensemble-section"><div className="section-heading"><div><div className="eyebrow">A SMALL CHANGE. A DIFFERENT OUTCOME.</div><h2>The ensemble tells the story.</h2></div><label className="ensemble-switch"><Switch checked={showEnsemble} onCheckedChange={setShowEnsemble} /> Show paths</label></div><div className="analysis-grid">{[result.selected, ...result.candidates.filter(shot => shot.plan.id !== result.selected.plan.id)].map((shot, index) => <button key={`${shot.plan.id}-${index}`} className={`analysis-card ${inspected === shot ? 'analysis-active' : ''}`} aria-pressed={inspected === shot} onClick={() => { setInspected(shot); setPlaying(false) }}><div className="analysis-card-title"><BallIcon id={shot.plan.ballId} small /><strong>{index === 0 ? 'Your selection' : `Ball ${shot.plan.ballId}`}</strong>{shot.plan.id === result.best.plan.id ? <span className="best-tag">BEST SHOT</span> : <ChevronRight size={15} />}</div><div className="analysis-rate">{percent(shot.successRate)}<span>successful outcomes</span></div><div className="rate-track"><span style={{ width: percent(shot.successRate) }} /></div><div className="analysis-metrics"><span>Pot <strong>{percent(shot.potRate)}</strong></span><span>Scratch <strong>{percent(shot.scratchRate)}</strong></span><span>Spread <strong>{(shot.spread * 100).toFixed(1)} cm</strong></span></div></button>)}</div><div className="ensemble-explanation"><FlaskConical size={17} /><p>{inspected?.explanation} <span>{result.samples} seeded trials per shot; 24 paths shown. Ranked by joint success, position accuracy, and safe pot rate.</span></p><Button variant="ghost" size="sm" onClick={() => inspected && playShot(inspected)} disabled={playing}><Play size={14} /> Replay</Button></div></section> : <section className="game-principles" aria-label="How the game works"><div><span className="principle-icon"><Focus size={22} strokeWidth={1.4} /></span><div><h3>Read the possibilities</h3><p>A new layout. A few choices.<br />One shot with a little more room.</p></div><span className="principle-index">01</span></div><div><span className="principle-icon"><Layers3 size={22} strokeWidth={1.4} /></span><div><h3>Think in probabilities</h3><p>Small changes in aim, spin, and power.<br />See how every outcome unfolds.</p></div><span className="principle-index">02</span></div><div><span className="principle-icon"><Flag size={22} strokeWidth={1.4} /></span><div><h3>Build your instincts</h3><p>Earn points for the safer choice.<br />Take on a tougher table.</p></div><span className="principle-index">03</span></div></section>}
      <footer className="site-footer"><span>PLAY THE PERCENTAGES.</span><button onClick={() => setModal('physics')}><span className="live-dot" /> Regulation dimensions. Simulated outcomes. <ArrowRight size={12} /></button><span>shotselection.app</span></footer>
    </main>

    <Dialog open={modal !== null} onOpenChange={open => { if (!open) setModal(null) }}><DialogContent>
      {modal === 'help' && <><div className="modal-symbol"><Crosshair size={25} /></div><DialogTitle>Play the percentages.</DialogTitle><DialogDescription>Shot Selection is about choosing the shot with room for a human mistake.</DialogDescription><ol className="help-steps"><li><strong>Choose a ball.</strong> Any colored ball is a legal target in this training game.</li><li><strong>Choose a finish.</strong> Click the cloth to mark where the white ball should stop. The ring allows a small position tolerance. You can also use the natural finish or zone buttons.</li><li><strong>Commit to your choice.</strong> The engine finds a stroke, then repeats it with small variations in aim, speed, and spin.</li><li><strong>Read the ensemble.</strong> Compare potting, scratch risk, and cue-ball spread for your shot and the alternatives. Watch the best shot, then advance.</li></ol><div className="scoring-guide"><span><strong>1 pt</strong> Best or close</span><span><strong>½ pt</strong> Near the best</span><span><strong>0 pts</strong> A less reliable choice</span></div><p className="modal-note">Rankings compare the sampled direct-pot candidates, including your selected finish. A tight spread only helps when the shot also succeeds.</p><Button className="full-width" onClick={() => setModal(null)}>Let’s read the table <ArrowRight size={16} /></Button></>}
      {modal === 'physics' && <><div className="modal-symbol"><FlaskConical size={25} /></div><DialogTitle>Real dimensions. Honest physics.</DialogTitle><DialogDescription>A deterministic simulation, with uncertainty added at the cue.</DialogDescription><dl className="physics-specs"><div><dt>Playing surface</dt><dd>2,540 × 1,270 mm</dd></div><div><dt>Ball diameter / mass</dt><dd>57.15 mm / 170 g</dd></div><div><dt>Physics engine</dt><dd>cannon-es · SI units</dd></div><div><dt>Simulation timestep</dt><dd>1 / 240 second</dd></div><div><dt>Ensemble</dt><dd>64 trials per candidate</dd></div></dl><p>The model includes ball collisions, cushion rebounds, sliding and rolling resistance, spin, pockets, and scratches. Shot planning searches direct pots and different stroke settings.</p><p className="modal-note">This is a training prototype. Cloth and cushion parameters are assumptions, pocket capture is simplified, and jump shots, masse, cue deflection, and full ball–ball throw are not calibrated. Real-table accuracy needs measured validation.</p><a className="source-link" href="https://wpapool.com/wp-content/uploads/2024/01/RECOMMENDED-EQUIPMENT-SPECIFICATIONS.pdf" target="_blank" rel="noreferrer">WPA equipment specifications <ArrowRight size={14} /></a></>}
      {modal === 'stats' && <><div className="modal-symbol"><Trophy size={25} /></div><DialogTitle>Your table sense, in numbers.</DialogTitle><DialogDescription>Session progress is saved in this browser.</DialogDescription><div className="stats-grid"><div><strong>{session.score.toFixed(1)}</strong><span>Total points</span></div><div><strong>{session.rounds}</strong><span>Rounds played</span></div><div><strong>{session.perfect}</strong><span>Full-point choices</span></div><div><strong>{session.rounds ? Math.round(session.score / session.rounds * 100) : 0}%</strong><span>Points earned</span></div></div><Button className="full-width" onClick={() => setModal(null)}>Back to the table</Button></>}
      {modal === 'reset' && <><DialogTitle>A fresh table?</DialogTitle><DialogDescription>This resets your saved session score and starts at level one with a new layout.</DialogDescription><div className="dialog-actions"><Button variant="outline" onClick={() => setModal(null)}>Keep playing</Button><Button onClick={() => { clearRound(freshSession()); setModal(null) }}><RotateCcw size={15} /> Start fresh</Button></div></>}
    </DialogContent></Dialog>
  </div>
}
