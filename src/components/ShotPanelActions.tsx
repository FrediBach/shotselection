import { ArrowLeft, ArrowRight, LoaderCircle, Play } from 'lucide-react'
import { Button } from './ui/button'

export function ResultActions({ playing, lastLesson, sandbox = false, onReplay, onNext }: {
  playing: boolean
  lastLesson: boolean
  sandbox?: boolean
  onReplay: () => void
  onNext: () => void
}) {
  return <>
    <Button className="full-width" onClick={onReplay} disabled={playing}><Play size={16} fill="currentColor" /> {playing ? 'Shot in motion…' : 'Play the best shot'}</Button>
    <Button className="full-width next-level" variant="outline" onClick={onNext}>{sandbox ? "New sandbox round" : lastLesson ? "View course summary" : "Next level"} <ArrowRight size={16} /></Button>
  </>
}

export function BallSelectionActions({ selectedBall, selectedBallLabel, preparing, ready, positionLesson, singleChoice, plantLesson, onContinue }: {
  selectedBall: number | null
  selectedBallLabel: string
  preparing: boolean
  ready: boolean
  positionLesson: boolean
  singleChoice: boolean
  plantLesson: boolean
  onContinue: () => void
}) {
  return <>
    <Button className="full-width lock-button" onClick={onContinue} disabled={selectedBall === null || preparing || !ready}>{positionLesson || singleChoice ? "Choose a stroke" : "Choose a finish"} <ArrowRight size={17} /></Button>
    <p className="lock-caption">{preparing ? plantLesson ? 'Preparing shot choices…' : 'Checking playable shots…' : selectedBall === null ? 'Select a ball to continue.' : `${selectedBallLabel} selected.`}</p>
  </>
}

export function FinishSelectionActions({ hasSelection, busy, preparing, ready, onSubmit, onBack }: {
  hasSelection: boolean
  busy: boolean
  preparing: boolean
  ready: boolean
  onSubmit: () => void
  onBack: () => void
}) {
  return <>
    <Button className="wizard-back" variant="ghost" onClick={onBack} disabled={busy}><ArrowLeft size={14} /> Back to balls</Button>
    <Button className="lock-button" onClick={onSubmit} disabled={!hasSelection || busy || preparing || !ready}>{busy ? <><LoaderCircle size={17} className="spin" /> Running ensemble…</> : <>Lock in your shot <ArrowRight size={17} /></>}</Button>
  </>
}
