import { useEffect, useRef, useState } from 'react'
import { ArrowRight, BookOpen, Check, Crosshair, FlaskConical, Gauge, SlidersHorizontal, Sparkles, Waves } from 'lucide-react'
import { Button } from './ui/button'
import { DEFAULT_CHARACTER, PREMADE_CHARACTERS, TALENT_DEFINITIONS, type PlayerCharacter } from '../engine/characters'
import { COURSE_CHAPTERS, TOTAL_LEVELS } from '../engine/course'
import type { GameMode } from '../lib/session'
import './CharacterSelection.css'

const styles = {
  'all-rounder': { title: 'The All-rounder', description: 'A steady hand in every part of the game.', icon: Sparkles },
  sharpshooter: { title: 'The Sharpshooter', description: 'Finds the line. Needs more room for pace and spin.', icon: Crosshair },
  'spin-artist': { title: 'The Spin Artist', description: 'A feel for English, draw, and follow.', icon: Waves },
  'pace-setter': { title: 'The Pace Setter', description: 'Knows just how much to put into a stroke.', icon: Gauge },
  custom: { title: 'Your own style', description: 'Build a player around the way you want to play.', icon: SlidersHorizontal },
}
const shortLabels = { anglePrecision: 'Angle', englishPrecision: 'English', strengthPrecision: 'Strength', spinPrecision: 'Draw / follow' }

export function PlayerTalents({ character }: { character: PlayerCharacter }) {
  return <dl className="player-talents">{TALENT_DEFINITIONS.map(talent => <div key={talent.key}>
    <dt>{talent.label}</dt><dd>{character.talents[talent.key]}<span> / 100</span></dd>
    <div className="talent-track" aria-hidden="true"><span style={{ width: `${character.talents[talent.key]}%` }} /></div>
  </div>)}</dl>
}

export default function CharacterSelection({ onStart }: { onStart: (character: PlayerCharacter, mode: GameMode) => void }) {
  const [mode, setMode] = useState<GameMode>('course')
  const [selectedId, setSelectedId] = useState(DEFAULT_CHARACTER.id)
  const [custom, setCustom] = useState<PlayerCharacter>({ id: 'custom', name: 'Your player', talents: { ...DEFAULT_CHARACTER.talents } })
  const hasCustomized = useRef(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const selected = selectedId === 'custom' ? custom : PREMADE_CHARACTERS.find(character => character.id === selectedId) ?? DEFAULT_CHARACTER
  const customSelected = selectedId === 'custom'
  const style = styles[selected.id as keyof typeof styles] ?? styles.custom
  const Icon = style.icon
  useEffect(() => { heading.current?.focus({ preventScroll: true }) }, [])

  function chooseCustom() {
    if (!hasCustomized.current) setCustom(previous => ({ ...previous, talents: { ...selected.talents } }))
    hasCustomized.current = true
    setSelectedId('custom')
  }

  return <section className="character-selection" aria-labelledby="character-heading">
    <div className="character-intro">
      <span className="eyebrow"><span className="live-dot" /> {mode === 'sandbox' ? 'YOUR PRACTICE TABLE' : 'A NEW PLAYTHROUGH'}</span>
      <h1 id="character-heading" ref={heading} tabIndex={-1}>Choose your player.</h1>
      <p>Every player has a different margin for error. Find your strengths, then learn which shots make the most of them.</p>
    </div>
    <div className="character-mode-choice">
      <div className="character-section-label"><span>01</span> CHOOSE HOW TO PLAY</div>
      <div className="character-modes" role="group" aria-label="Play mode">
        <button type="button" className={`character-mode-card${mode === 'course' ? ' character-selected' : ''}`} aria-label="Course mode" aria-pressed={mode === 'course'} onClick={() => setMode('course')}>
          <BookOpen size={23} strokeWidth={1.4} /><span><strong>Course</strong><span>Learn through {TOTAL_LEVELS} lessons. Build your total score as you progress through every scenario.</span></span><span className="character-selected-mark" aria-hidden="true">{mode === 'course' && <Check size={14} />}</span>
        </button>
        <button type="button" className={`character-mode-card${mode === 'sandbox' ? ' character-selected' : ''}`} aria-label="Sandbox mode" aria-pressed={mode === 'sandbox'} onClick={() => setMode('sandbox')}>
          <FlaskConical size={23} strokeWidth={1.4} /><span><strong>Sandbox</strong><span>Choose any scenario with random or custom ball positions. Same round scoring and ensemble, with no total score or progression.</span></span><span className="character-selected-mark" aria-hidden="true">{mode === 'sandbox' && <Check size={14} />}</span>
        </button>
      </div>
    </div>
    <div className="character-layout">
      <div className="character-roster">
        <div className="character-section-label"><span>02</span> PICK YOUR STYLE</div>
        <div className="character-presets" role="group" aria-label="Premade players">
          {PREMADE_CHARACTERS.map(character => {
            const meta = styles[character.id as keyof typeof styles] ?? styles['all-rounder']
            const Portrait = meta.icon
            const active = selectedId === character.id
            return <button type="button" key={character.id} className={`character-card${active ? ' character-selected' : ''}`} aria-pressed={active} aria-label={`Choose ${character.name}`} onClick={() => setSelectedId(character.id)}>
              <span className="character-card-top"><span className={`character-emblem character-emblem-${character.id}`}><Portrait size={24} strokeWidth={1.4} /></span><span className="character-card-name"><strong>{character.name}</strong><span>{meta.title}</span></span><span className="character-selected-mark" aria-hidden="true">{active && <Check size={14} />}</span></span>
              <span className="character-card-description">{meta.description}</span>
              <span className="character-mini-talents">{TALENT_DEFINITIONS.map(talent => <span key={talent.key}><span>{shortLabels[talent.key]}</span><strong>{character.talents[talent.key]}</strong><span className="talent-track" aria-hidden="true"><span style={{ width: `${character.talents[talent.key]}%` }} /></span></span>)}</span>
            </button>
          })}
        </div>
        <button type="button" className={`character-custom-choice${customSelected ? ' character-selected' : ''}`} aria-pressed={customSelected} onClick={chooseCustom}>
          <SlidersHorizontal size={22} strokeWidth={1.4} /><span><strong>Create a custom player</strong><span>Set every talent to your liking.</span></span>{customSelected ? <Check size={18} /> : <ArrowRight size={18} />}
        </button>
        <p className="character-roster-note">{mode === 'sandbox' ? 'Your player’s talents apply to every sandbox setup. Start a new session to try a different style.' : `Your player stays with you through all ${TOTAL_LEVELS} lessons. Start a new playthrough to try a different style.`}</p>
      </div>
      <section className="character-build" aria-label="Selected player talents">
        <div className="character-section-label"><span>03</span> {customSelected ? 'MAKE IT YOURS' : 'KNOW YOUR STRENGTHS'}</div>
        <div className="character-build-heading"><Icon size={22} strokeWidth={1.4} /><div><span>{style.title}</span><h2>{customSelected ? 'Build your player.' : selected.name}</h2></div></div>
        {customSelected && <div className="character-name-field"><label htmlFor="player-name">Player name</label><input id="player-name" value={custom.name} maxLength={40} autoComplete="off" onChange={event => setCustom(previous => ({ ...previous, name: event.target.value }))} /></div>}
        <p className="talent-scale-note">Higher precision means less variation in your ensembles. 50 is balanced; 100 is the steadiest.</p>
        {customSelected ? <div className="character-sliders">{TALENT_DEFINITIONS.map(talent => <div className="character-slider" key={talent.key}>
          <div><label htmlFor={`talent-${talent.key}`}>{talent.label}</label><output htmlFor={`talent-${talent.key}`}>{custom.talents[talent.key]}<span> / 100</span></output></div>
          <input id={`talent-${talent.key}`} type="range" min={0} max={100} step={1} value={custom.talents[talent.key]} aria-describedby={`talent-description-${talent.key}`} style={{ '--talent-value': `${custom.talents[talent.key]}%` } as React.CSSProperties} onChange={event => setCustom(previous => ({ ...previous, talents: { ...previous.talents, [talent.key]: Number(event.target.value) } }))} />
          <p id={`talent-description-${talent.key}`}>{talent.description}</p>
        </div>)}</div> : <><PlayerTalents character={selected} /><p className="character-build-tip">Like this style? You can also use it as a starting point for your custom player.</p></>}
        <div className="character-start"><Button className="full-width" onClick={() => onStart({ ...selected, name: selected.name.trim() || 'Custom player', talents: { ...selected.talents } }, mode)}>{mode === 'sandbox' ? 'Start sandbox' : 'Start playthrough'} <ArrowRight size={17} /></Button><span>{mode === 'sandbox' ? 'A fresh challenge whenever you want to explore.' : `One player. ${COURSE_CHAPTERS.length} scenarios. Your best decisions.`}</span></div>
      </section>
    </div>
    <div className="character-explainer"><Waves size={21} /><p><strong>Your talents shape the ensemble.</strong> Angle controls your aim, English controls side spin, strength controls pace, and draw / follow controls forward and backward spin. The best shot is the one your player can repeat.</p></div>
  </section>
}
