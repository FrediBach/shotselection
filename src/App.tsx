import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowDownRight, ArrowLeft, ArrowRight, Check, ChevronRight, CircleHelp, Crosshair, Flag, FlaskConical, Focus, Layers3, LoaderCircle, MousePointer2, Play, RotateCcw, Target, Trophy, Volume2, VolumeX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import PoolTable from '@/components/PoolTable'
import PerfectCelebration from '@/components/PerfectCelebration'
import ShotTolerancePanel from '@/components/ShotTolerancePanel'
import { analyzeRoundAsync, generateScenario, prepareRoundAsync, scoreSelection } from '@/engine'
import type { PreparedRound, RoundAnalysis, ShotAnalysis, ShotPlan } from '@/engine/types'
import { freshSession, loadSession, SESSION_STORAGE_KEY, type Session } from '@/lib/session'
import { createGameAudio } from '@/lib/sound'

type Modal = 'help' | 'physics' | 'stats' | 'reset' | null
const HELP_DISMISSED_KEY = 'shot-selection-help-dismissed'
const SOUND_ENABLED_KEY = 'shot-selection-sound-enabled'
function loadSoundEnabled() {
  try { return localStorage.getItem(SOUND_ENABLED_KEY) !== 'false' }
  catch { return true }
}
function initialModal(): Modal {
  try { return localStorage.getItem(HELP_DISMISSED_KEY) === 'true' ? null : 'help' }
  catch { return 'help' }
}
const colors: Record<number, string> = { 1: '#e9b14e', 2: '#6594d2', 3: '#db7466', 4: '#a68cce', 5: '#e59857', 6: '#71aa89', 7: '#b7747d', 8: '#787e79' }
const percent = (value: number) => `${Math.round(value * 100)}%`
function strokeDescription(plan: ShotPlan) {
  const spin = plan.topSpin < -0.1 ? 'Backspin' : plan.topSpin > 0.1 ? 'Topspin' : 'Center ball'
  const amount = Math.abs(plan.topSpin) > 0.1 ? ` ${Math.round(Math.abs(plan.topSpin) * 100)}%` : ''
  const side = Math.abs(plan.sideSpin) > 0.1 ? ` · ${plan.sideSpin > 0 ? 'Left' : 'Right'} spin` : ''
  return `${spin}${amount}${side}`
}
function BallIcon({ id, small = false }: { id: number; small?: boolean }) {
  return <span className={`ball-icon ${small ? 'ball-small' : ''}`} style={{ '--ball-color': colors[id] || '#939f8b' } as React.CSSProperties}><span>{id}</span></span>
}
function ScorePlacement({ shot, candidates }: { shot: ShotAnalysis; candidates: ShotAnalysis[] }) {
  const scoring = scoreSelection(shot, candidates)
  return <p className="analysis-placement"><span>{scoring.tiedCount > 1 ? 'Joint rank' : 'Rank'} {scoring.rank} of {scoring.candidateCount}</span><strong>{scoring.points} / 100</strong></p>
}

export default function App() {
  const [session, setSession] = useState<Session>(loadSession)
  const [requestedScenario, setScenario] = useState(() => generateScenario(session.level, session.seed + session.level * 919))
  const [prepared, setPrepared] = useState<PreparedRound | null>(null)
  const [preparing, setPreparing] = useState(true)
  const [prepareAttempt, setPrepareAttempt] = useState(0)
  const [selectedBall, setSelectedBall] = useState<number | null>(null)
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null)
  const [selectionStep, setSelectionStep] = useState<'ball' | 'finish'>('ball')
  const [result, setResult] = useState<RoundAnalysis | null>(null)
  const [inspected, setInspected] = useState<ShotAnalysis | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [showEnsemble, setShowEnsemble] = useState(true)
  const [playing, setPlaying] = useState(false)
  const [playbackKey, setPlaybackKey] = useState(0)
  const [modal, setModal] = useState<Modal>(initialModal)
  const [soundEnabled, setSoundEnabled] = useState(loadSoundEnabled)
  const [celebrating, setCelebrating] = useState(false)
  const audio = useRef<ReturnType<typeof createGameAudio> | null>(null)
  const finishCelebration = useCallback(() => setCelebrating(false), [])
  const sidebarHeading = useRef<HTMLHeadingElement>(null)
  const previousStep = useRef(1)
  const request = useRef(0)
  const analysisController = useRef<AbortController | null>(null)
  useEffect(() => {
    const player = createGameAudio()
    audio.current = player
    const stopWhenHidden = () => { if (document.hidden) player.stop() }
    document.addEventListener('visibilitychange', stopWhenHidden)
    return () => {
      document.removeEventListener('visibilitychange', stopWhenHidden)
      player.dispose()
      audio.current = null
    }
  }, [])
  useEffect(() => {
    audio.current?.setEnabled(soundEnabled)
    try { localStorage.setItem(SOUND_ENABLED_KEY, String(soundEnabled)) } catch { /* Sound works without browser storage. */ }
  }, [soundEnabled])
  useEffect(() => () => { request.current += 1; analysisController.current?.abort() }, [])
  useEffect(() => { try { localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session)) } catch { /* Browser storage can be unavailable. */ } }, [session])
  useEffect(() => {
    const controller = new AbortController()
    setPreparing(true); setPrepared(null); setError('')
    prepareRoundAsync(requestedScenario, { signal: controller.signal })
      .then(round => { if (!controller.signal.aborted) setPrepared(round) })
      .catch(cause => {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'The finish options could not be prepared. Please try again.')
      })
      .finally(() => { if (!controller.signal.aborted) setPreparing(false) })
    return () => controller.abort()
  }, [requestedScenario, prepareAttempt])
  const scenario = prepared?.scenario ?? requestedScenario
  const objectBalls = scenario.balls.filter(ball => ball.id > 0)
  const selectableBallIds = prepared?.balls.map(ball => ball.ballId) ?? []
  const finishOptions = prepared?.balls.find(ball => ball.ballId === selectedBall)?.options ?? []
  const selectedOption = finishOptions.find(option => option.id === selectedOptionId) ?? null
  const target = selectedOption?.plan.target ?? null
  const finishLabel = (id: string) => prepared?.balls.flatMap(ball => ball.options).find(option => option.id === id)?.label ?? ''
  const difficulty = scenario.level <= 3 ? 'Fundamentals' : scenario.level <= 7 ? 'Position play' : 'Precision play'
  const step = result ? 3 : selectionStep === 'ball' ? 1 : 2
  useEffect(() => {
    if (previousStep.current !== step) sidebarHeading.current?.focus({ preventScroll: true })
    previousStep.current = step
  }, [step])
  const selectBall = (id: number) => {
    if (!busy && !preparing && !result && selectableBallIds.includes(id)) {
      audio.current?.unlock()
      if (id !== selectedBall) audio.current?.play('select')
      if (id !== selectedBall) setSelectedOptionId(null)
      setSelectedBall(id); setError('')
    }
  }
  const selectOption = (id: string) => {
    if (selectionStep === 'finish' && !busy && !preparing && !result && finishOptions.some(option => option.id === id)) {
      audio.current?.unlock()
      if (id !== selectedOptionId) audio.current?.play('select')
      setSelectedOptionId(id); setError('')
    }
  }
  function clearRound(next: Session) {
    audio.current?.stop()
    setCelebrating(false)
    request.current += 1
    analysisController.current?.abort()
    setSession(next); setScenario(generateScenario(next.level, next.seed + next.level * 919)); setSelectedBall(null); setSelectedOptionId(null)
    setPrepared(null); setPreparing(true)
    setSelectionStep('ball')
    setResult(null); setInspected(null); setBusy(false); setPlaying(false); setError('')
  }
  async function submit() {
    if (selectionStep !== 'finish' || !prepared || selectedBall === null || !selectedOption || busy || preparing || result) return
    audio.current?.unlock()
    audio.current?.play('confirm')
    const id = ++request.current
    analysisController.current = new AbortController()
    setBusy(true); setError('')
    try {
      const analysis = await analyzeRoundAsync(prepared, { ballId: selectedBall, optionId: selectedOption.id }, { samples: 64, signal: analysisController.current.signal })
      if (id !== request.current) return
      setResult(analysis); setInspected(analysis.selected)
      setCelebrating(analysis.points === 100)
      if (!document.hidden) audio.current?.play(analysis.points === 100 ? 'perfect' : 'result')
      // Persist the next unplayed level, so reloading cannot score this round twice.
      setSession(previous => ({ ...previous, level: scenario.level + 1, rounds: previous.rounds + 1, score: previous.score + analysis.points, perfect: previous.perfect + Number(analysis.points === 100) }))
    } catch (cause) {
      if (id === request.current) setError(cause instanceof Error ? cause.message : 'The simulation could not finish. Please try again.')
    } finally { if (id === request.current) setBusy(false) }
  }
  function closeModal() {
    if (modal === 'help') {
      try { localStorage.setItem(HELP_DISMISSED_KEY, 'true') }
      catch { /* Help remains usable when browser storage is unavailable. */ }
    }
    setModal(null)
  }
  function toggleSound() {
    const enabled = !soundEnabled
    audio.current?.setEnabled(enabled)
    setSoundEnabled(enabled)
    if (enabled) { audio.current?.unlock(); audio.current?.play('select') }
  }
  function playShot(shot: ShotAnalysis) {
    audio.current?.stop()
    audio.current?.unlock()
    setCelebrating(false)
    setInspected(shot); setPlaying(true); setPlaybackKey(previous => previous + 1)
  }

  return <div className="app-shell">
    <header className="site-header">
      <a className="brand" href="/" aria-label="Shot Selection home"><span className="brand-mark"><span /></span><span>shot<span className="brand-light">selection</span><span className="brand-period">.</span></span></a>
      <nav className="main-nav" aria-label="Main navigation"><button className="nav-active" onClick={() => closeModal()}>The game</button><button className="nav-help" aria-label="How to play" onClick={() => setModal('help')}><CircleHelp className="nav-help-icon" size={18} /><span className="nav-help-label">How to play</span><ArrowDownRight className="nav-help-arrow" size={13} /></button><button onClick={() => setModal('physics')}>Behind the physics</button></nav>
      <button className="session-score" onClick={() => setModal('stats')} aria-label={`View session stats, ${session.score} points`}><Trophy size={15} /><span>{session.score} <span className="muted">pts</span></span><span className="score-divider" /><span className="session-label">This session</span><ChevronRight size={14} /></button>
    </header>

    <main>
      <h1 className="sr-only">Shot Selection</h1>
      <div className="game-layout">
        <section className="table-panel" aria-label="Interactive pool table">
          <div className="table-toolbar"><div className="level-label"><span className="level-number">{String(scenario.level).padStart(2, '0')}</span><div><div className="toolbar-title">{difficulty}</div><div className="toolbar-caption">LEVEL {String(scenario.level).padStart(2, '0')} <span>·</span> {objectBalls.length} OBJECT BALLS</div></div></div><div className="table-actions"><span className="table-size">9 FT <span>TOURNAMENT TABLE</span></span><Button variant="ghost" size="icon" className="sound-toggle" aria-label={soundEnabled ? 'Mute sound effects' : 'Enable sound effects'} aria-pressed={soundEnabled} title={soundEnabled ? 'Mute sound effects' : 'Enable sound effects'} onClick={toggleSound}>{soundEnabled ? <Volume2 size={17} /> : <VolumeX size={17} />}</Button><Button variant="ghost" size="icon" aria-label="Restart session" title="Restart session" onClick={() => setModal('reset')} disabled={busy}><RotateCcw size={16} /></Button></div></div>
          <div className="table-stage">
            <div className="table-instruction"><span className={result ? 'instruction-dot complete' : 'instruction-dot'} />{playing ? 'Playing the simulated shot' : result ? 'Explore the paths. Find the pattern.' : preparing ? 'Preparing playable finish options' : selectionStep === 'ball' ? (selectedBall === null ? 'Start by selecting an object ball' : `Ball ${selectedBall} selected. Choose a finish next.`) : target === null ? 'Choose finish A, B, or C' : 'Your call. Ready when you are.'}</div>
            <div className="pool-canvas"><PoolTable scenario={scenario} selectedBall={result ? inspected?.plan.ballId ?? selectedBall : selectedBall} target={result ? inspected?.plan.target || target : selectionStep === 'finish' ? target : null} onSelectBall={selectBall} finishOptions={result || selectionStep !== 'finish' ? [] : finishOptions} selectedOptionId={selectedOptionId} onSelectOption={selectOption} selectableBallIds={selectableBallIds} analysis={inspected} showEnsemble={Boolean(result) && showEnsemble} playing={playing} playbackKey={playbackKey} onPlaybackSound={event => { if (!document.hidden) audio.current?.play(event.type === 'cue' ? 'shot' : event.type === 'ball' ? 'collision' : event.type, event.strength) }} onPlaybackEnd={() => { setPlaying(false); audio.current?.stop() }} interactive={!preparing && !busy && !result && Boolean(prepared)} /></div>
            {celebrating && <PerfectCelebration onComplete={finishCelebration} />}
            <div className="table-watermark">SHOT SELECTION <span>EST. 2026</span></div>
            {(busy || preparing) && <div className="simulation-overlay" role="status"><LoaderCircle className="spin" size={25} /><strong>{preparing ? 'Finding three playable finishes' : 'Finding the margin for error'}</strong><span>{preparing ? 'Checking the pot, cue-ball position, and stroke for each option…' : 'Simulating small variations in every offered shot…'}</span></div>}
          </div>
          <div className="table-footer"><div className="table-legend"><span><i className={result ? "legend-cue-path" : "legend-cue"} /> {result ? 'Cue paths' : 'Cue ball'}</span><span><i className="legend-target" /> Desired finish</span>{result && <><span><i className="legend-object-pot" /> Object pots</span><span><i className="legend-object-miss" /> Misses / fouls</span></>}</div><span className="interactive-hint"><MousePointer2 size={13} /> {result ? 'Select a shot below to inspect' : 'Pick a ball, then A, B, or C'}</span></div>
        </section>

        <aside className="shot-panel" aria-label="Shot selection steps">
          <div className="shot-panel-heading"><span className="eyebrow">{result ? 'ROUND COMPLETE' : 'YOUR NEXT MOVE'}</span><span className="tiny-pill">STEP {step} OF 3</span></div>
          <ol className="shot-progress" aria-label="Round progress">
            {['Ball', 'Finish', 'Result'].map((label, index) => <li key={label} className={step === index + 1 ? 'step-current' : step > index + 1 ? 'step-complete' : ''} aria-current={step === index + 1 ? 'step' : undefined}>
              <span>{step > index + 1 ? <Check size={11} /> : index + 1}</span>{label}
            </li>)}
          </ol>
          <div className="shot-panel-body" data-step={result ? 'result' : selectionStep} key={`${scenario.level}-${step}`}>
            {result ? <>
              <h2 ref={sidebarHeading} tabIndex={-1}>{result.candidates.every(shot => shot.successRate === 0) ? 'A difficult table.' : result.points === 100 ? 'That’s the smart shot.' : result.points >= 80 ? 'A strong choice.' : result.points >= 50 ? 'Room to improve.' : 'There’s a safer way.'}</h2>
              <div className={`points-awarded${result.points === 100 ? ' points-perfect' : ''}`}><span>{result.points === 100 ? <Trophy size={18} /> : <Target size={18} />} Round score</span><strong>{result.points} <span>/ 100</span></strong></div>
              <section className="score-breakdown" aria-label="How your score adds up">
                <h3>How your score adds up</h3>
                <dl>
                  <div><dt>Shot quality<span>About {percent(result.scoring.relativeQuality)} of best quality</span></dt><dd>{result.scoring.qualityPoints}<span> / 70</span></dd></div>
                  <div><dt>Ensemble rank<span>{result.scoring.tiedCount > 1 ? 'Joint ' : ''}rank {result.scoring.rank} of {result.scoring.candidateCount} choices</span></dt><dd>{result.scoring.rankPoints}<span> / 30</span></dd></div>
                </dl>
                <p>{result.scoring.noSuccessfulTrials ? `No successful pot + finish in ${result.samples} trials, so both parts earn 0.` : 'Quality rewards pots, safe finishes and target accuracy. Rank rewards your place among all choices.'}</p>
                <p className="score-rounding">{result.scoring.qualityPoints} + {result.scoring.rankPoints} = {result.points}. Each part rounds to 10 points. Similar results share a rank.</p>
              </section>
              <div className="result-comparison"><div><span>Your shot · {finishLabel(result.selected.plan.id)}</span><strong>{percent(result.selected.successRate)}</strong></div><div><span>Best <BallIcon id={result.best.plan.ballId} small /> · {finishLabel(result.best.plan.id)}</span><strong>{percent(result.best.successRate)}</strong></div><p>Pot + safe finish in {result.samples} trials, within {Math.round(result.positionTolerance * 100)} cm of the target.</p></div>
            </> : selectionStep === 'ball' ? <>
              <h2 ref={sidebarHeading} tabIndex={-1}>Choose your ball.</h2>
              <p className="panel-description">Which ball gives you the most room for error?</p>
              <div className="ball-choices" role="group" aria-label="Object ball choices">{objectBalls.map(ball => <button key={ball.id} className={`ball-choice ${selectedBall === ball.id ? 'selected' : ''}`} onClick={() => selectBall(ball.id)} disabled={preparing || !selectableBallIds.includes(ball.id)} title={prepared && !selectableBallIds.includes(ball.id) ? 'No three playable finishes found for this ball' : `Choose ball ${ball.id}`} aria-pressed={selectedBall === ball.id} aria-label={`Select ball ${ball.id}`}><BallIcon id={ball.id} /><span>Ball {ball.id}</span>{selectedBall === ball.id && <span className="ball-check"><Check size={10} /></span>}</button>)}</div>
              {prepared && selectableBallIds.length < objectBalls.length && <p className="unavailable-note">Dimmed balls have no set of three playable finishes.</p>}
              <div className="wizard-hint"><MousePointer2 size={17} /><p>Choose a ball here or directly on the table. Then move on to its finish positions.</p></div>
            </> : <>
              <h2 ref={sidebarHeading} tabIndex={-1}>Choose your finish.</h2>
              <p className="panel-description">Where should the cue ball stop? Pick A, B, or C on the table or below.</p>
              {selectedBall !== null && <div className="selected-ball-summary"><BallIcon id={selectedBall} /><span>Your object ball<strong>Ball {selectedBall}</strong></span></div>}
              <div className="finish-options" role="group" aria-label="Cue-ball finish options">
                {finishOptions.map(option => <button
                  key={option.id}
                  className={`finish-option ${selectedOptionId === option.id ? 'finish-selected' : ''}`}
                  aria-label={`Choose finish ${option.label}`}
                  aria-pressed={selectedOptionId === option.id}
                  disabled={busy}
                  onClick={() => selectOption(option.id)}
                >
                  <span className="finish-letter">{option.label}</span>
                  <span className="finish-copy"><strong>{option.plan.speed.toFixed(2)} m/s <span>cue-ball speed</span></strong><span title="Spin percentage is relative to natural rolling at launch, not cue-tip offset.">{strokeDescription(option.plan)}</span></span>
                  {selectedOptionId === option.id && <Check size={14} />}
                </button>)}
              </div>
              <p className="finish-assurance">All three are playable. Choose the most forgiving.</p>
            </>}
            {error && <div role="alert" className="error-message"><p>{error}</p>{!prepared && !preparing && <Button variant="outline" size="sm" onClick={() => setPrepareAttempt(attempt => attempt + 1)}>Retry preparation</Button>}</div>}
          </div>
          <div className="shot-panel-actions">
            {result ? <>
              <Button className="full-width" onClick={() => playShot(result.best)} disabled={playing}><Play size={16} fill="currentColor" /> {playing ? 'Shot in motion…' : 'Play the best shot'}</Button>
              <Button className="full-width next-level" variant="outline" onClick={() => clearRound(session)}>Next level <ArrowRight size={16} /></Button>
            </> : selectionStep === 'ball' ? <>
              <Button className="full-width lock-button" onClick={() => setSelectionStep('finish')} disabled={selectedBall === null || preparing || !prepared}>Choose a finish <ArrowRight size={17} /></Button>
              <p className="lock-caption">{preparing ? 'Checking playable shots…' : selectedBall === null ? 'Select a ball to continue.' : `Ball ${selectedBall} selected.`}</p>
            </> : <>
              <Button className="lock-button full-width" onClick={submit} disabled={!selectedOption || busy || preparing || !prepared}>{busy ? <><LoaderCircle size={17} className="spin" /> Running ensemble…</> : <>Lock in your shot <ArrowRight size={17} /></>}</Button>
              <Button className="wizard-back full-width" variant="ghost" onClick={() => setSelectionStep('ball')} disabled={busy}><ArrowLeft size={14} /> Back to balls</Button>
            </>}
          </div>
        </aside>
      </div>

      {result ? <section className="ensemble-section"><div className="section-heading"><div><div className="eyebrow">A SMALL CHANGE. A DIFFERENT OUTCOME.</div><h2>The ensemble tells the story.</h2></div><label className="ensemble-switch"><Switch checked={showEnsemble} onCheckedChange={setShowEnsemble} /> Show paths</label></div><div className="analysis-grid">{[result.selected, ...result.candidates.filter(shot => shot.plan.id !== result.selected.plan.id)].map((shot, index) => <button key={`${shot.plan.id}-${index}`} className={`analysis-card ${inspected === shot ? 'analysis-active' : ''}`} aria-pressed={inspected === shot} onClick={() => { audio.current?.stop(); audio.current?.unlock(); audio.current?.play('select'); setInspected(shot); setPlaying(false) }}><div className="analysis-card-title"><BallIcon id={shot.plan.ballId} small /><strong>{index === 0 ? `Your selection · ${finishLabel(shot.plan.id)}` : `Ball ${shot.plan.ballId} · ${finishLabel(shot.plan.id)}`}</strong>{shot.plan.id === result.best.plan.id ? <span className="best-tag">BEST SHOT</span> : <ChevronRight size={15} />}</div><ScorePlacement shot={shot} candidates={result.candidates} /><p className="analysis-stroke">{shot.plan.speed.toFixed(2)} m/s · {strokeDescription(shot.plan)}</p><div className="analysis-rate">{percent(shot.successRate)}<span>successful outcomes</span></div><div className="rate-track"><span style={{ width: percent(shot.successRate) }} /></div><div className="analysis-metrics"><span>Pot <strong>{percent(shot.potRate)}</strong></span><span>Scratch <strong>{percent(shot.scratchRate)}</strong></span><span>Spread <strong>{(shot.spread * 100).toFixed(1)} cm</strong></span></div></button>)}</div><div className="ensemble-explanation"><FlaskConical size={17} /><p>{inspected?.explanation} <span>{result.samples} seeded trials per shot; {inspected?.sampleObjectPaths.length ?? 0} object-ball paths and {inspected?.samplePaths.length ?? 0} cue-ball paths shown. A pot can still scratch; success also requires a safe cue-ball finish.</span></p><Button variant="ghost" size="sm" onClick={() => inspected && playShot(inspected)} disabled={playing}><Play size={14} /> Replay</Button></div></section> : <section className="game-principles" aria-label="How the game works"><div><span className="principle-icon"><Focus size={22} strokeWidth={1.4} /></span><div><h3>Read the possibilities</h3><p>A new layout. A few choices.<br />One shot with a little more room.</p></div><span className="principle-index">01</span></div><div><span className="principle-icon"><Layers3 size={22} strokeWidth={1.4} /></span><div><h3>Think in probabilities</h3><p>Small changes in aim, spin, and power.<br />See how every outcome unfolds.</p></div><span className="principle-index">02</span></div><div><span className="principle-icon"><Flag size={22} strokeWidth={1.4} /></span><div><h3>Build your instincts</h3><p>Earn points for the safer choice.<br />Take on a tougher table.</p></div><span className="principle-index">03</span></div></section>}
      {result && inspected && <ShotTolerancePanel key={`${scenario.level}-${scenario.seed}`} scenario={scenario} shot={inspected} best={result.best} shotLabel={`Ball ${inspected.plan.ballId} · ${finishLabel(inspected.plan.id)}`} bestLabel={`Ball ${result.best.plan.ballId} · ${finishLabel(result.best.plan.id)}`} isSelection={inspected.plan.id === result.selected.plan.id} />}
      <footer className="site-footer"><span>PLAY THE PERCENTAGES.</span><button onClick={() => setModal('physics')}><span className="live-dot" /> Regulation dimensions. Simulated outcomes. <ArrowRight size={12} /></button><span>shotselection.app</span></footer>
    </main>

    <Dialog open={modal !== null} onOpenChange={open => { if (!open) closeModal() }}><DialogContent>
      {modal === 'help' && <><div className="modal-symbol"><Crosshair size={25} /></div><DialogTitle>Play the percentages.</DialogTitle><DialogDescription>Shot Selection is about choosing the shot with room for a human mistake.</DialogDescription><ol className="help-steps"><li><strong>Choose a ball.</strong> Choose an available colored ball, then select “Choose a finish”. Dimmed balls have no set of three playable finishes.</li><li><strong>Choose a finish.</strong> Pick one of the three marked positions: A, B, or C. Use the table markers or the matching buttons. Each finish is reachable with its own cue speed and spin. Use “Back to balls” to change your target; switching balls clears the finish.</li><li><strong>Commit to your choice.</strong> The engine repeats the exact stroke behind each option with small variations in aim, speed, and spin. All three work with a precise stroke, but some tolerate mistakes better.</li><li><strong>Read the ensemble.</strong> Compare the pale cue-ball paths, cyan object-ball pots, and dashed coral misses or fouls. A cyan path can still scratch or miss the cue-ball finish, so compare overall success too. Watch the best shot, then advance.</li></ol><div className="scoring-guide"><span><strong>70 pts</strong> Quality vs. the best</span><span><strong>30 pts</strong> Rank among choices</span><span><strong>100 pts</strong> Maximum per round</span></div><p className="modal-note">Each part rounds to the nearest 10 points. Quality compares potting, safe finishes and target accuracy with the best ensemble. Similar results share a rank. No successful pot and finish in the trials means 0 points. The result shows the breakdown.</p><Button className="full-width" onClick={() => closeModal()}>Let’s read the table <ArrowRight size={16} /></Button></>}
      {modal === 'physics' && <><div className="modal-symbol"><FlaskConical size={25} /></div><DialogTitle>Real dimensions. Honest physics.</DialogTitle><DialogDescription>A deterministic simulation, with uncertainty added at the cue.</DialogDescription><dl className="physics-specs"><div><dt>Playing surface</dt><dd>2,540 × 1,270 mm</dd></div><div><dt>Ball diameter / mass</dt><dd>57.15 mm / 170 g</dd></div><div><dt>Physics engine</dt><dd>cannon-es · SI units</dd></div><div><dt>Simulation timestep</dt><dd>1 / 240 second</dd></div><div><dt>Ensemble</dt><dd>64 trials per candidate</dd></div></dl><p>The model includes ball collisions, cushion rebounds, sliding and rolling resistance, spin, pockets, and scratches. Shot planning searches direct pots and different stroke settings.</p><p className="modal-note">This is a training prototype. Cloth and cushion parameters are assumptions, pocket capture is simplified, and jump shots, masse, cue deflection, and full ball–ball throw are not calibrated. Real-table accuracy needs measured validation.</p><a className="source-link" href="https://wpapool.com/wp-content/uploads/2024/01/RECOMMENDED-EQUIPMENT-SPECIFICATIONS.pdf" target="_blank" rel="noreferrer">WPA equipment specifications <ArrowRight size={14} /></a></>}
      {modal === 'stats' && <><div className="modal-symbol"><Trophy size={25} /></div><DialogTitle>Your table sense, in numbers.</DialogTitle><DialogDescription>Session progress is saved in this browser.</DialogDescription><div className="stats-grid"><div><strong>{session.score}</strong><span>Total points</span></div><div><strong>{session.rounds}</strong><span>Rounds played</span></div><div><strong>{session.perfect}</strong><span>100-point choices</span></div><div><strong>{session.rounds ? Math.round(session.score / session.rounds) : 0}%</strong><span>Points earned</span></div></div><Button className="full-width" onClick={() => closeModal()}>Back to the table</Button></>}
      {modal === 'reset' && <><DialogTitle>A fresh table?</DialogTitle><DialogDescription>This resets your saved session score and starts at level one with a new layout.</DialogDescription><div className="dialog-actions"><Button variant="outline" onClick={() => closeModal()}>Keep playing</Button><Button onClick={() => { clearRound(freshSession()); closeModal() }}><RotateCcw size={15} /> Start fresh</Button></div></>}
    </DialogContent></Dialog>
  </div>
}
