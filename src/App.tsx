import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowDownRight, ArrowRight, BookOpen, Check, ChevronRight, CircleHelp, Crosshair, Flag, FlaskConical, Focus, Layers3, LoaderCircle, MousePointer2, RotateCcw, Trophy, Volume2, VolumeX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import BallIcon from '@/components/BallIcon'
import EnsembleResults from '@/components/EnsembleResults'
import BallSelectionStep from '@/components/BallSelectionStep'
import FinishSelectionStep from '@/components/FinishSelectionStep'
import RoundResultStep from '@/components/RoundResultStep'
import ShotFeedbackDialog from '@/components/ShotFeedbackDialog'
import { ResultActions, BallSelectionActions, FinishSelectionActions } from '@/components/ShotPanelActions'
import PoolTable from '@/components/PoolTable'
import PerfectCelebration from '@/components/PerfectCelebration'
import ShotTolerancePanel from '@/components/ShotTolerancePanel'
import CourseProgress, { CourseCompletion } from '@/components/CourseProgress'
import GameDialogBody, { type Modal } from '@/components/GameDialogBody'
import CharacterSelection from '@/components/CharacterSelection'
import SandboxSetup from '@/components/SandboxSetup'
import { TableConditionSummary } from '@/components/TableConditions'
import type { PlayerCharacter } from '@/engine/characters'
import { TOTAL_LEVELS } from '@/engine/scenarios'
import { analyzeRoundAsync, generateScenario, prepareRoundAsync } from '@/engine'
import type { PreparedRound, RoundAnalysis, ShotAnalysis, ShotPlan } from '@/engine/types'
import { completeLesson, freshSession, loadSession, SESSION_STORAGE_KEY, type GameMode, type Session } from '@/lib/session'
import { createGameAudio } from '@/lib/sound'

const HELP_DISMISSED_KEY = 'shot-selection-help-dismissed'
const SOUND_ENABLED_KEY = 'shot-selection-sound-enabled'
function loadSoundEnabled() {
  try { return localStorage.getItem(SOUND_ENABLED_KEY) !== 'false' }
  catch { return true }
}
function initialModal(courseComplete: boolean): Modal {
  try { return localStorage.getItem(HELP_DISMISSED_KEY) === 'true' ? courseComplete ? null : 'lesson' : 'help' }
  catch { return 'help' }
}
export default function App() {
  const [session, setSession] = useState<Session>(loadSession)
  const sandbox = session.mode === 'sandbox'
  const [sandboxPlacement, setSandboxPlacement] = useState<'random' | 'manual'>('random')
  const [showSandboxSetup, setShowSandboxSetup] = useState(() => session.mode === 'sandbox')
  const [showCourseSummary, setShowCourseSummary] = useState(() => session.mode !== 'sandbox' && session.completedLessons === TOTAL_LEVELS)
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
  const [showFinishes, setShowFinishes] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [playbackKey, setPlaybackKey] = useState(0)
  const [modal, setModal] = useState<Modal>(() => session.character && !sandbox ? initialModal(showCourseSummary) : null)
  const [lessonStarted, setLessonStarted] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(loadSoundEnabled)
  const [celebrating, setCelebrating] = useState(false)
  const audio = useRef<ReturnType<typeof createGameAudio> | null>(null)
  const finishCelebration = useCallback(() => setCelebrating(false), [])
  const sidebarHeading = useRef<HTMLHeadingElement>(null)
  const completionHeading = useRef<HTMLHeadingElement>(null)
  const dialogHeading = useRef<HTMLHeadingElement>(null)
  const dialogOpener = useRef<HTMLElement | null>(null)
  const previousStep = useRef(1)
  const request = useRef(0)
  const analysisController = useRef<AbortController | null>(null)
  useEffect(() => {
    if (!modal) return
    dialogHeading.current?.focus({ preventScroll: true })
    dialogHeading.current?.closest('.dialog-content')?.scrollTo(0, 0)
  }, [modal, requestedScenario.level])
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
    if (session.mode === 'sandbox' || showCourseSummary || !session.character) { setPreparing(false); return () => controller.abort() }
    setPreparing(true); setPrepared(null); setError('')
    prepareRoundAsync(requestedScenario, { signal: controller.signal })
      .then(round => {
        if (!controller.signal.aborted) {
          setPrepared(round)
          setSelectedBall(round.balls.length === 1 ? round.balls[0].ballId : null)
        }
      })
      .catch(cause => {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'The finish options could not be prepared. Please try again.')
      })
      .finally(() => { if (!controller.signal.aborted) setPreparing(false) })
    return () => controller.abort()
  }, [requestedScenario, prepareAttempt, showCourseSummary, session.character, session.mode])
  const scenario = prepared?.scenario ?? requestedScenario
  const objectBalls = scenario.balls.filter(ball => ball.id > 0)
  const selectableBallIds = prepared?.balls.map(ball => ball.ballId) ?? []
  const selectableBalls = new Set(selectableBallIds)
  const finishOptions = prepared?.balls.find(ball => ball.ballId === selectedBall)?.options ?? []
  const selectedOption = finishOptions.find(option => option.id === selectedOptionId) ?? null
  // Preview the first offered approach until a finish is chosen; labels are not rankings.
  const approachOption = result ? null : selectedOption ?? finishOptions[0] ?? null
  const target = selectedOption?.plan.target ?? null
  const finishLabel = (id: string) => prepared?.balls.flatMap(ball => ball.options).find(option => option.id === id)?.label ?? ''
  const difficulty = scenario.curriculum?.chapterTitle ?? 'Training'
  const objective = scenario.objective
  const plant = scenario.plant
  const trick = scenario.trick
  const predictFinish = Boolean(objective || trick)
  const ballChoiceLabel = (ballId: number) => trick ? ballId === trick.ballId ? `First ball ${ballId}` : trick.requiredPots.includes(ballId) ? `Pot ${ballId}` : `Setup ball ${ballId}` : plant ? ballId === plant.ballId ? `Plant ${ballId} → ${plant.targetBallId}` : ballId === plant.targetBallId ? `Target ${ballId}` : `Free ball ${ballId}` : `Ball ${ballId}`
  const shotLabel = (plan: ShotPlan) => trick ? `Trick · pot ${trick.requiredPots.join(' + ')}` : plan.potBallId !== undefined && plan.potBallId !== plan.ballId ? `Plant ${plan.ballId} → ${plan.potBallId}` : plant ? `Free ball ${plan.ballId}` : `Ball ${plan.ballId}`
  const lastLesson = !sandbox && (scenario.level === TOTAL_LEVELS || Boolean(result && session.completedLessons === TOTAL_LEVELS))
  const showPlannedFinish = Boolean(result && predictFinish && inspected?.nominal.stopped && !inspected.nominal.scratch && !playing)
  const step = result ? 3 : selectionStep === 'ball' ? 1 : 2
  useEffect(() => {
    if (previousStep.current !== step && !modal) sidebarHeading.current?.focus({ preventScroll: true })
    previousStep.current = step
  }, [step, modal])
  const selectBall = (id: number) => {
    if (!busy && !preparing && !result && selectableBalls.has(id)) {
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
  function resetRoundState() {
    audio.current?.stop()
    setCelebrating(false)
    setShowCourseSummary(false)
    request.current += 1
    analysisController.current?.abort()
    setSelectedBall(null); setSelectedOptionId(null)
    setPrepared(null); setPreparing(true)
    setSelectionStep('ball')
    setResult(null); setInspected(null); setBusy(false); setPlaying(false); setError('')
    dialogOpener.current = null
    setLessonStarted(false)
    setModal(null)
  }
  function clearRound(next: Session) {
    resetRoundState()
    setSession(next)
    setScenario(generateScenario(next.level, next.seed + next.level * 919))
    setShowSandboxSetup(next.mode === 'sandbox')
    setSandboxPlacement('random')
    setModal(next.character && next.mode !== 'sandbox' ? 'lesson' : null)
    if (!next.character) window.scrollTo(0, 0)
  }
  function startPlaythrough(character: PlayerCharacter, mode: GameMode) {
    setSession(previous => ({ ...previous, character, mode }))
    setShowSandboxSetup(mode === 'sandbox')
    setSandboxPlacement('random')
    setModal(mode === 'sandbox' ? null : initialModal(false))
    window.scrollTo(0, 0)
  }
  function startSandboxRound(round: PreparedRound) {
    resetRoundState()
    setScenario(round.scenario)
    setPrepared(round)
    setSelectedBall(round.balls.length === 1 ? round.balls[0].ballId : null)
    setPreparing(false)
    setShowSandboxSetup(false)
    setModal('lesson')
    window.scrollTo(0, 0)
  }
  function configureSandbox(placement: 'random' | 'manual' = 'random') {
    setSandboxPlacement(placement)
    setScenario(scenario)
    resetRoundState()
    setPreparing(false)
    setShowSandboxSetup(true)
    window.scrollTo(0, 0)
  }
  async function submit() {
    if (!session.character || selectionStep !== 'finish' || !prepared || selectedBall === null || !selectedOption || busy || preparing || result) return
    audio.current?.unlock()
    audio.current?.play('confirm')
    const id = ++request.current
    analysisController.current = new AbortController()
    setBusy(true); setError('')
    try {
      const analysis = await analyzeRoundAsync(prepared, { ballId: selectedBall, optionId: selectedOption.id }, { samples: 64, talents: session.character.talents, signal: analysisController.current.signal })
      if (id !== request.current) return
      setResult(analysis); setInspected(analysis.selected)
      setCelebrating(analysis.points === 100)
      if (!document.hidden) audio.current?.play(analysis.points === 100 ? 'perfect' : 'result')
      // Persist the next unplayed level, so reloading cannot score this round twice.
      if (!sandbox) setSession(previous => completeLesson(previous, scenario.level, analysis.points))
    } catch (cause) {
      if (id === request.current) setError(cause instanceof Error ? cause.message : 'The simulation could not finish. Please try again.')
    } finally { if (id === request.current) setBusy(false) }
  }
  function openModal(next: Exclude<Modal, null>, opener: HTMLElement) {
    dialogOpener.current = opener
    setModal(next)
  }
  function closeModal() {
    if (modal === 'help') {
      try { localStorage.setItem(HELP_DISMISSED_KEY, 'true') }
      catch { /* Help remains usable when browser storage is unavailable. */ }
    }
    if (!sandbox && session.character && modal !== 'lesson' && !lessonStarted && !showCourseSummary) {
      dialogOpener.current = null
      setModal('lesson')
      return
    }
    if (modal === 'lesson') setLessonStarted(true)
    setModal(null)
  }
  function toggleSound() {
    const enabled = !soundEnabled
    audio.current?.setEnabled(enabled)
    setSoundEnabled(enabled)
    if (enabled) { audio.current?.unlock(); audio.current?.play('select') }
  }
  function advanceRound() {
    if (sandbox) { configureSandbox(); return }
    if (!lastLesson) { clearRound(session); return }
    audio.current?.stop()
    setPlaying(false); setCelebrating(false); setShowCourseSummary(true)
  }
  function inspectShot(shot: ShotAnalysis) {
    audio.current?.stop(); audio.current?.unlock(); audio.current?.play('select')
    setInspected(shot); setPlaying(false)
  }
  function playShot(shot: ShotAnalysis) {
    audio.current?.stop()
    audio.current?.unlock()
    setCelebrating(false)
    setInspected(shot); setPlaying(true); setPlaybackKey(previous => previous + 1)
  }

  return <div className="app-shell">
    <a className="skip-link" href="#main-content">Skip to game</a>
    <header className="site-header">
      <a className="brand" href="/" aria-label="Shot Selection home"><span className="brand-mark"><span /></span><span>shot<span className="brand-light">selection</span><span className="brand-period">.</span></span></a>
      <nav className="main-nav" aria-label="Main navigation"><button className="nav-active" onClick={() => closeModal()}>The game</button><button className="nav-help" aria-label="How to play" aria-haspopup="dialog" onClick={event => openModal('help', event.currentTarget)}><CircleHelp className="nav-help-icon" size={18} /><span className="nav-help-label">How to play</span><ArrowDownRight className="nav-help-arrow" size={13} /></button><button aria-haspopup="dialog" onClick={event => openModal('physics', event.currentTarget)}>Behind the physics</button></nav>
      {sandbox ? <span className="session-score sandbox-badge"><FlaskConical size={16} /> Sandbox</span> : <button className="session-score" onClick={event => openModal('stats', event.currentTarget)} aria-haspopup="dialog" aria-label={`View session stats, ${session.score} points`}><Trophy size={15} /><span>{session.score} <span className="muted">pts</span></span><span className="score-divider" /><span className="session-label">This session</span><ChevronRight size={14} /></button>}
    </header>

    <main id="main-content" tabIndex={-1}>
      {!session.character ? <CharacterSelection onStart={startPlaythrough} /> : <>
      {!(sandbox && showSandboxSetup) && <h1 className="sr-only">Shot Selection</h1>}
      {!sandbox && <CourseProgress completed={session.completedLessons} scenario={scenario} carriedTournamentLessons={session.carriedTournamentLessons} />}
      <div className="playthrough-player"><Crosshair size={15} /><span>Playing as <strong>{session.character.name}</strong></span><button aria-label="View player talents" aria-haspopup="dialog" onClick={event => openModal('character', event.currentTarget)}>Player talents <ChevronRight size={13} /></button></div>
      {sandbox && <div className="sandbox-session-actions"><span>Round scores only · No progression</span>{!showSandboxSetup && <Button variant="outline" size="sm" onClick={() => configureSandbox('manual')}>Change setup</Button>}<Button variant="ghost" size="sm" onClick={event => openModal('reset', event.currentTarget)}>Change player or mode</Button></div>}
      {sandbox && showSandboxSetup ? <SandboxSetup initialPlacement={sandboxPlacement} initialScenario={requestedScenario} onStart={startSandboxRound} /> : showCourseSummary ? <CourseCompletion score={session.score} perfect={session.perfect} rounds={session.rounds} headingRef={completionHeading} onRestart={() => clearRound(freshSession())} /> : <>
      <div className="game-layout">
        <section className={`table-panel${objective ? " table-panel-position" : ""}${scenario.conditions ? " table-panel-broken" : ""}`} aria-label="Interactive pool table">
          <div className="table-toolbar"><div className="level-label"><span className="level-number">{sandbox ? <FlaskConical size={21} /> : String(scenario.level).padStart(2, '0')}</span><div><div className="toolbar-title">{difficulty}</div><div className="toolbar-caption">{sandbox ? 'SANDBOX' : `LEVEL ${String(scenario.level).padStart(2, '0')} OF ${TOTAL_LEVELS}`} <span>·</span> {objectBalls.length} OBJECT BALL{objectBalls.length === 1 ? "" : "S"}</div></div></div><div className="table-actions"><span className="table-size">9 FT <span>{scenario.conditions ? scenario.level === TOTAL_LEVELS ? 'FINAL BOSS' : 'HOUSE SPECIAL' : 'TOURNAMENT TABLE'}</span></span><Button variant="ghost" size="icon" aria-label={sandbox ? "Review scenario briefing" : "Review level briefing"} title={sandbox ? "Review scenario briefing" : "Review level briefing"} aria-haspopup="dialog" onClick={event => openModal('lesson', event.currentTarget)}><BookOpen size={17} /></Button><Button variant="ghost" size="icon" className="sound-toggle" aria-label={soundEnabled ? 'Mute sound effects' : 'Enable sound effects'} aria-pressed={soundEnabled} title={soundEnabled ? 'Mute sound effects' : 'Enable sound effects'} onClick={toggleSound}>{soundEnabled ? <Volume2 size={17} /> : <VolumeX size={17} />}</Button><Button variant="ghost" size="icon" aria-label="Restart session" title="Restart session" aria-haspopup="dialog" onClick={event => openModal('reset', event.currentTarget)} disabled={busy}><RotateCcw size={16} /></Button></div></div>
          {scenario.conditions && <TableConditionSummary conditions={scenario.conditions} finalBoss={scenario.curriculum?.lessonIndex === 9} />}
          <div className="table-stage">
            <div className="table-instruction"><span className={result ? 'instruction-dot complete' : 'instruction-dot'} />{playing ? 'Playing the simulated shot' : result ? 'Explore the paths. Find the pattern.' : preparing ? predictFinish ? 'Preparing stroke choices' : plant ? 'Preparing plant and free-ball choices' : 'Preparing playable finish options' : selectionStep === 'ball' ? (selectedBall === null ? plant ? 'Compare the plant with the free ball' : 'Start by selecting an object ball' : `${ballChoiceLabel(selectedBall)} selected. Choose a ${predictFinish || selectableBallIds.length === 1 ? "stroke" : "finish"} next.`) : selectedOption === null ? predictFinish ? 'Choose a stroke in the side panel' : 'Choose finish A, B, or C' : 'Your call. Ready when you are.'}</div>
            <div className="pool-canvas"><PoolTable scenario={scenario} selectedBall={result ? inspected?.plan.ballId ?? selectedBall : selectedBall} target={result ? inspected?.plan.target || target : !predictFinish && selectionStep === 'finish' ? target : null} onSelectBall={selectBall} approachOption={approachOption} finishOptions={predictFinish || result || selectionStep !== 'finish' ? [] : finishOptions} selectedOptionId={selectedOptionId} onSelectOption={selectOption} selectableBallIds={selectableBallIds} analysis={inspected} showEnsemble={Boolean(result) && showEnsemble} showFinishes={Boolean(result) && showFinishes} playing={playing} playbackKey={playbackKey} onPlaybackSound={event => { if (!document.hidden) audio.current?.play(event.type === 'cue' ? 'shot' : event.type === 'ball' ? 'collision' : event.type, event.strength) }} onPlaybackEnd={() => { setPlaying(false); audio.current?.stop() }} interactive={!preparing && !busy && !result && Boolean(prepared)} /></div>
            {celebrating && <PerfectCelebration onComplete={finishCelebration} />}
            <div className="table-watermark">SHOT SELECTION <span>EST. 2026</span></div>
            {(busy || preparing) && <div className="simulation-overlay" role="status"><LoaderCircle className="spin" size={25} /><strong>{preparing ? predictFinish ? 'Preparing three playable strokes' : plant ? 'Preparing plant and free-ball options' : 'Finding three playable finishes' : 'Finding the margin for error'}</strong><span>{preparing ? 'Checking the pot, cue-ball position, and stroke for each option…' : 'Simulating small variations in every offered shot…'}</span></div>}
          </div>
          <div className="table-footer">
            <div className="table-legend" role="group" aria-label="Table legend">
              <span title={approachOption ? 'Ideal cue-ball approach for this stroke, ending at first contact.' : undefined}><i aria-hidden="true" className={result ? "legend-cue-path" : approachOption ? "legend-approach-path" : "legend-cue"} /> {result ? 'Cue paths' : approachOption ? `Ideal path · ${approachOption.label}` : 'Cue ball'}</span>
              {!trick && <span><i aria-hidden="true" className={objective ? "legend-position" : "legend-target"} /> {objective ? "Position zone" : "Desired finish"}</span>}
              {objective && <span><span className="legend-next-swatch" aria-hidden="true"><BallIcon id={objective.nextBallId} small /></span> Next ball {objective.nextBallId}</span>}
              {showPlannedFinish && <span><i aria-hidden="true" className="legend-planned-finish" /> Planned finish</span>}
              {result && <><span><i aria-hidden="true" className="legend-object-pot" /> Object pots</span><span><i aria-hidden="true" className="legend-object-miss" /> Misses / fouls</span></>}
            </div>
            {!predictFinish && <span className="interactive-hint"><MousePointer2 size={13} /> {result ? 'Select a shot below to inspect' : 'Pick a ball, then A, B, or C'}</span>}
          </div>
        </section>

        <aside className="shot-panel" aria-label="Shot selection steps">
          <div className="shot-panel-heading"><span className="eyebrow">{result ? 'ROUND COMPLETE' : 'YOUR NEXT MOVE'}</span><span className="tiny-pill">STEP {step} OF 3</span></div>
          <ol className="shot-progress" aria-label="Round progress">
            {['Ball', predictFinish ? 'Stroke' : 'Finish', 'Result'].map((label, index) => <li key={label} className={step === index + 1 ? 'step-current' : step > index + 1 ? 'step-complete' : ''} aria-current={step === index + 1 ? 'step' : undefined}>
              <span>{step > index + 1 ? <Check size={11} /> : index + 1}</span>{label}
            </li>)}
          </ol>
          <div className="shot-panel-body" data-step={result ? 'result' : selectionStep} key={`${scenario.level}-${step}`}>
            {result ? <RoundResultStep result={result} scenario={scenario} headingRef={sidebarHeading} shotLabel={shotLabel} finishLabel={finishLabel} onExplain={opener => openModal('feedback', opener)} /> : selectionStep === 'ball' ? <BallSelectionStep scenario={scenario} selectedBall={selectedBall} selectableBallIds={selectableBallIds} preparing={preparing} ready={Boolean(prepared)} headingRef={sidebarHeading} ballChoiceLabel={ballChoiceLabel} onSelect={selectBall} /> : <FinishSelectionStep scenario={scenario} selectedBall={selectedBall} finishOptions={finishOptions} selectedOptionId={selectedOptionId} busy={busy} headingRef={sidebarHeading} ballChoiceLabel={ballChoiceLabel} onSelect={selectOption} />}
            {error && <div role="alert" className="error-message"><p>{error}</p>{!prepared && !preparing && <Button variant="outline" size="sm" onClick={() => setPrepareAttempt(attempt => attempt + 1)}>Retry preparation</Button>}</div>}
          </div>
          <div className="shot-panel-actions">
            {result ? <ResultActions playing={playing} lastLesson={lastLesson} sandbox={sandbox} onReplay={() => playShot(result.best)} onNext={advanceRound} />
              : selectionStep === 'ball' ? <BallSelectionActions selectedBall={selectedBall} selectedBallLabel={selectedBall === null ? '' : ballChoiceLabel(selectedBall)} preparing={preparing} ready={Boolean(prepared)} positionLesson={predictFinish} singleChoice={selectableBallIds.length === 1} plantLesson={Boolean(plant)} onContinue={() => setSelectionStep('finish')} />
              : <FinishSelectionActions hasSelection={Boolean(selectedOption)} busy={busy} preparing={preparing} ready={Boolean(prepared)} onSubmit={submit} onBack={() => setSelectionStep('ball')} />}
          </div>
        </aside>
      </div>

      {result && <section className="lesson-review" aria-label="Lesson takeaway"><span className="lesson-goal-label"><Check size={16} /> {sandbox ? 'SANDBOX ROUND COMPLETE' : `LESSON ${scenario.level} COMPLETE`}</span><h2>{scenario.curriculum?.takeaway}</h2><p>{trick ? "Check every required pot and contact in the replay, then compare how often the whole trick and cue-ball finish repeat." : objective ? `A pot only starts the pattern. Compare the zone rate and next-shot rate below: success needs both, along with a legal pot.` : "Compare your selection with the best shot, then watch the replay to connect the lesson to the cue-ball path."}</p><span>{sandbox ? 'Try a new layout or change the scenario. Every round is a fresh experiment.' : lastLesson ? `All ${TOTAL_LEVELS} lessons completed. Your course summary is ready.` : `Up next: ${generateScenario(session.level).title}`}</span></section>}
      {result ? <EnsembleResults result={result} scenario={scenario} inspected={inspected} playerName={session.character.name} showEnsemble={showEnsemble} showFinishes={showFinishes} playing={playing} showPlannedFinish={showPlannedFinish} onShowEnsemble={setShowEnsemble} onShowFinishes={setShowFinishes} onInspect={inspectShot} onPlay={playShot} shotLabel={shotLabel} finishLabel={finishLabel} /> : <section className="game-principles" aria-label="How the game works"><div><span className="principle-icon"><Focus size={22} strokeWidth={1.4} /></span><div><h3>Read the possibilities</h3><p>A new layout. A few choices.<br />{' '}One shot with a little more room.</p></div><span className="principle-index">01</span></div><div><span className="principle-icon"><Layers3 size={22} strokeWidth={1.4} /></span><div><h3>Think in probabilities</h3><p>Small changes in aim, spin, and power.<br />{' '}See how every outcome unfolds.</p></div><span className="principle-index">02</span></div><div><span className="principle-icon"><Flag size={22} strokeWidth={1.4} /></span><div><h3>Build your instincts</h3><p>Earn points for the safer choice.<br />{' '}{sandbox ? 'Try another layout.' : 'Take on a tougher table.'}</p></div><span className="principle-index">03</span></div></section>}
      {result && inspected && <ShotTolerancePanel key={`${scenario.level}-${scenario.seed}`} scenario={scenario} shot={inspected} best={result.best} shotLabel={`${shotLabel(inspected.plan)} · ${finishLabel(inspected.plan.id)}`} bestLabel={`${shotLabel(result.best.plan)} · ${finishLabel(result.best.plan.id)}`} isSelection={inspected.plan.id === result.selected.plan.id} />}
      </>}
      </>}
      <footer className="site-footer"><span>PLAY THE PERCENTAGES.</span><button aria-haspopup="dialog" onClick={event => openModal('physics', event.currentTarget)}><span className="live-dot" /> Regulation dimensions. Simulated outcomes. <ArrowRight size={12} /></button><a href="https://fredibach.com">© 2026 Fredi Bach</a></footer>
    </main>

    <Dialog open={modal !== null} onOpenChange={open => { if (!open) closeModal() }}><DialogContent
      className={modal === 'lesson' ? 'level-briefing' : modal === 'feedback' ? 'shot-feedback-dialog' : undefined}
      onOpenAutoFocus={event => { event.preventDefault(); dialogHeading.current?.focus({ preventScroll: true }) }}
      onCloseAutoFocus={event => {
        event.preventDefault()
        const opener = dialogOpener.current
        if (opener?.isConnected) opener.focus({ preventScroll: true })
        else if (showCourseSummary) completionHeading.current?.focus({ preventScroll: true })
        else if (!session.character) document.getElementById('character-heading')?.focus({ preventScroll: true })
        else if (sandbox && showSandboxSetup) document.getElementById('sandbox-heading')?.focus({ preventScroll: true })
        else sidebarHeading.current?.focus({ preventScroll: true })
      }}
    >
      {modal === 'feedback' && result
        ? <ShotFeedbackDialog result={result} scenario={scenario} headingRef={dialogHeading} shotLabel={shotLabel} finishLabel={finishLabel} onClose={closeModal} onReplay={() => { closeModal(); playShot(result.best) }} />
        : <GameDialogBody modal={modal} scenario={scenario} session={session} headingRef={dialogHeading} lessonStarted={lessonStarted} onClose={closeModal} onRestart={() => clearRound(freshSession())} />}
    </DialogContent></Dialog>
  </div>
}
