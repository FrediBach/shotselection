import { useEffect, useId, useRef, useState } from 'react'
import { Copy, FlaskConical, LoaderCircle, LockKeyhole, Plus, RotateCcw, Sparkles, Trash2, UnlockKeyhole } from 'lucide-react'
import { analyzeLabAsync, fitLabShotAsync } from '../engine/client'
import { POCKETS, TABLE } from '../engine/constants'
import { createLabScenario, DEFAULT_LAB_SHOT_SETTINGS, generateLabVariants, LAB_SHOT_LIMITS, MAX_LAB_BALLS, MAX_LAB_VARIANTS, resizeLabBalls } from '../engine/lab'
import type { LabResult, LabShotAnalysis, LabShotSettings, LabVariant } from '../engine/lab'
import type { LabShotLocks } from '../engine/lab-auto'
import { validateSandboxLayout } from '../engine/sandbox'
import type { PlayerCharacter, Scenario, Vec2 } from '../engine/types'
import BallLayoutEditor from './BallLayoutEditor'
import { Button } from './ui/button'
import './LabMode.css'

type NumericSetting = 'speed' | 'topSpin' | 'sideSpin' | 'aimOffset'
const NUMERIC_FIELDS: { key: NumericSetting; label: string }[] = [
  { key: 'speed', label: 'Strength (m/s)' },
  { key: 'topSpin', label: 'Draw / follow' },
  { key: 'sideSpin', label: 'Sidespin (rad/s)' },
  { key: 'aimOffset', label: 'Aim offset (°)' },
]
const BALL_COLORS = ['#f4f1e7', '#e9b14e', '#6594d2', '#db7466', '#a68cce', '#e59857', '#71aa89', '#b7747d', '#787e79']
const ballColor = (id: number) => BALL_COLORS[id > 8 ? id - 8 : id] ?? '#c4c0a7'
const percent = (rate: number) => `${(rate * 100).toFixed(1)}%`
const points = (path: Vec2[]) => path.map(point => `${point.x},${point.y}`).join(' ')
const freshSeed = () => Math.floor(Math.random() * 0x7fffffff)
const initialVariants = (): LabVariant[] => [0.7, 1.3, 2.1].map((speed, index) => ({
  id: `lab-option-${index + 1}`, label: ['Soft', 'Medium', 'Firm'][index], settings: { ...DEFAULT_LAB_SHOT_SETTINGS, speed },
}))
type FitStatus = 'idle' | 'queued' | 'fitting' | 'found' | 'not-found' | 'invalid'
interface ShotAssistance { enabled: boolean; locks: LabShotLocks; status: FitStatus; message: string }
const freshAssistance = (enabled = true, locks: LabShotLocks = {}): ShotAssistance => ({ enabled, locks, status: 'idle', message: '' })
const FIELD_NAMES: Record<keyof LabShotSettings, string> = { ballId: 'ball', pocketId: 'pocket', speed: 'strength', topSpin: 'draw / follow', sideSpin: 'sidespin', aimOffset: 'aim' }
type FieldLock = { locked: boolean; onToggle: () => void }

function LockButton({ label, lock }: { label: string; lock?: FieldLock }) {
  if (!lock) return null
  return <button className={`lab-field-lock${lock.locked ? ' is-locked' : ''}`} type="button" aria-label={`${lock.locked ? 'Unlock' : 'Lock'} ${label}`} aria-pressed={lock.locked} title={lock.locked ? 'Keep this value. Click to let auto adapt it.' : 'Auto may adapt this value. Click to keep it.'} onClick={lock.onToggle}>{lock.locked ? <LockKeyhole size={13} /> : <UnlockKeyhole size={13} />}</button>
}

function settingsError(settings: LabShotSettings, locks?: LabShotLocks): string | null {
  for (const { key, label } of NUMERIC_FIELDS) {
    if (locks && !locks[key]) continue
    const { min, max } = LAB_SHOT_LIMITS[key]
    if (!Number.isFinite(settings[key]) || settings[key] < min || settings[key] > max) return `${label} must be between ${min} and ${max}.`
  }
  return null
}

function NumberField({ label, value, min, max, step = 'any', onChange, lock }: { label: string; value: number; min: number; max: number; step?: number | 'any'; onChange: (value: number) => void; lock?: FieldLock }) {
  const id = useId()
  const [draft, setDraft] = useState<string | null>(null)
  return <div className="lab-field"><div className="lab-field-label"><label htmlFor={id}>{label}</label><LockButton label={label} lock={lock} /></div><input id={id} type="number" min={min} max={max} step={step} value={draft ?? (Number.isFinite(value) ? Number(value.toFixed(5)) : '')} onBlur={() => setDraft(null)} onChange={event => {
    setDraft(event.target.value)
    onChange(event.target.valueAsNumber)
  }} /></div>
}

function NumericFields({ settings, onChange, locks, onToggleLock }: { settings: LabShotSettings; onChange: (settings: LabShotSettings, field: keyof LabShotSettings) => void; locks?: LabShotLocks; onToggleLock?: (field: keyof LabShotSettings) => void }) {
  return <div className="lab-numeric-fields">{NUMERIC_FIELDS.map(({ key, label }) => <NumberField key={key} label={label} value={settings[key]} {...LAB_SHOT_LIMITS[key]} lock={onToggleLock ? { locked: !!locks?.[key], onToggle: () => onToggleLock(key) } : undefined} onChange={value => onChange({ ...settings, [key]: value }, key)} />)}</div>
}

function ShotTarget({ scenario, settings, onChange, prefix = '', locks, onToggleLock }: { scenario: Scenario; settings: LabShotSettings; onChange: (settings: LabShotSettings, field: keyof LabShotSettings) => void; prefix?: string; locks?: LabShotLocks; onToggleLock?: (field: keyof LabShotSettings) => void }) {
  const id = useId()
  const ballMissing = !scenario.balls.some(ball => ball.id === settings.ballId && ball.id !== 0)
  return <div className="lab-target-fields">
    <div className="lab-field"><div className="lab-field-label"><label htmlFor={`${id}-ball`}>{prefix}Ball</label><LockButton label="Ball" lock={onToggleLock ? { locked: !!locks?.ballId, onToggle: () => onToggleLock('ballId') } : undefined} /></div><select id={`${id}-ball`} aria-label={`${prefix}ball`.replace(/^b/, 'B')} value={settings.ballId} onChange={event => onChange({ ...settings, ballId: Number(event.target.value) }, 'ballId')}>{ballMissing && <option value={settings.ballId}>Ball {settings.ballId} (unavailable)</option>}{scenario.balls.filter(ball => ball.id !== 0).map(ball => <option key={ball.id} value={ball.id}>Ball {ball.id}</option>)}</select></div>
    <div className="lab-field"><div className="lab-field-label"><label htmlFor={`${id}-pocket`}>{prefix}Pocket</label><LockButton label="Pocket" lock={onToggleLock ? { locked: !!locks?.pocketId, onToggle: () => onToggleLock('pocketId') } : undefined} /></div><select id={`${id}-pocket`} aria-label={`${prefix}pocket`.replace(/^p/, 'P')} value={settings.pocketId} onChange={event => onChange({ ...settings, pocketId: Number(event.target.value) }, 'pocketId')}>{POCKETS.map(pocket => <option key={pocket.id} value={pocket.id}>{pocket.name}</option>)}</select></div>
  </div>
}

function ShotOptionEditor({ scenario, variant, assistance, index, canAdd, canRemove, onUpdate, onDuplicate, onRemove, onToggleLock, onToggleAuto, onFit }: {
  scenario: Scenario; variant: LabVariant; assistance: ShotAssistance; index: number; canAdd: boolean; canRemove: boolean
  onUpdate: (changes: Partial<LabVariant>, field?: keyof LabShotSettings) => void; onDuplicate: () => void; onRemove: () => void; onToggleLock: (field: keyof LabShotSettings) => void; onToggleAuto: () => void; onFit: () => void
}) {
  const fitting = assistance.status === 'queued' || assistance.status === 'fitting'
  return <fieldset className="lab-option" aria-label={`Option ${index + 1}`}>
    <legend><span className="lab-option-number">{String(index + 1).padStart(2, '0')}</span> Shot option</legend>
    <div className="lab-option-heading">
      <label className="lab-field" htmlFor={`${variant.id}-name`}><span>Name</span><input id={`${variant.id}-name`} type="text" maxLength={60} value={variant.label} onChange={event => onUpdate({ label: event.target.value })} onBlur={() => { if (!variant.label.trim()) onUpdate({ label: `Option ${index + 1}` }) }} /></label>
      <Button type="button" variant="ghost" size="icon" aria-label={`Duplicate option ${index + 1}`} title="Duplicate option" disabled={!canAdd} onClick={onDuplicate}><Copy size={16} /></Button>
      <Button type="button" variant="ghost" size="icon" aria-label={`Remove option ${index + 1}`} title="Remove option" disabled={!canRemove} onClick={onRemove}><Trash2 size={16} /></Button>
    </div>
    <label className="lab-auto-toggle"><input type="checkbox" aria-label={`Auto-adapt option ${index + 1}`} checked={assistance.enabled} onChange={onToggleAuto} /><span>Auto-adapt</span><small>{assistance.enabled ? 'Unlocked values can change' : 'Manual experiment'}</small></label>
    <ShotTarget scenario={scenario} settings={variant.settings} locks={assistance.locks} onToggleLock={onToggleLock} onChange={(settings, field) => onUpdate({ settings }, field)} />
    <NumericFields settings={variant.settings} locks={assistance.locks} onToggleLock={onToggleLock} onChange={(settings, field) => onUpdate({ settings }, field)} />
    <div className="lab-option-fit"><Button type="button" variant="outline" size="sm" disabled={fitting || !!validateSandboxLayout(scenario)} onClick={onFit}>{fitting ? <LoaderCircle size={14} className="sandbox-spinner" /> : <Sparkles size={14} />} Find playable shot</Button><p className="lab-fit-status" data-status={assistance.status} role="status">{assistance.message || (assistance.enabled ? 'Set a value to lock it; auto adapts the rest.' : 'Values stay as entered. Fit once or enable auto to adapt unlocked values.')}</p></div>
  </fieldset>
}

interface MorphSettings { start: LabShotSettings; end: LabShotSettings; steps: number }
function morphValidation({ start, end, steps }: MorphSettings) {
  return settingsError(start) ?? settingsError(end) ?? (!Number.isInteger(steps) || steps < 2 || steps > MAX_LAB_VARIANTS ? `Choose 2–${MAX_LAB_VARIANTS} steps.` : null)
}

function MorphEditor({ scenario, variants, value, onChange, onGenerate }: { scenario: Scenario; variants: LabVariant[]; value: MorphSettings; onChange: (value: MorphSettings) => void; onGenerate: (append: boolean) => void }) {
  const { start, end, steps } = value
  const error = morphValidation(value)
  const tooMany = variants.length + steps > MAX_LAB_VARIANTS
  return <details className="lab-morph">
    <summary>Morph between two strokes <span>Generate evenly spaced options</span></summary>
    <div className="lab-morph-content">
      <p className="lab-note">Set a start and an end. Every numeric value changes together in equal steps; the ball and pocket stay fixed. Both endpoints are included. Generated options start with auto-adapt off. Their target and varied values are locked, so fitting later preserves your series while adapting the other values.</p>
      <div className="lab-morph-toolbar">
        <ShotTarget scenario={scenario} settings={start} prefix="Morph " onChange={settings => onChange({ ...value, start: settings, end: { ...end, ballId: settings.ballId, pocketId: settings.pocketId } })} />
        <Button type="button" variant="outline" size="sm" onClick={() => onChange({ ...value, start: { ...variants[0].settings }, end: { ...variants[variants.length - 1].settings, ballId: variants[0].settings.ballId, pocketId: variants[0].settings.pocketId } })}>Use first and last options</Button>
      </div>
      <div className="lab-morph-endpoints">
        <fieldset aria-label="Morph start"><legend>From · start</legend><NumericFields settings={start} onChange={settings => onChange({ ...value, start: settings })} /></fieldset>
        <fieldset aria-label="Morph end"><legend>To · end</legend><NumericFields settings={end} onChange={settings => onChange({ ...value, end: settings })} /></fieldset>
      </div>
      <div className="lab-morph-actions">
        <NumberField label="Steps (including endpoints)" value={steps} min={2} max={MAX_LAB_VARIANTS} step={1} onChange={number => onChange({ ...value, steps: number })} />
        <Button type="button" variant="outline" disabled={!!error} onClick={() => onGenerate(false)}>Replace options with steps</Button>
        <Button type="button" variant="outline" disabled={!!error || tooMany} onClick={() => onGenerate(true)}>Append steps</Button>
      </div>
      {error ? <p className="lab-error" role="status">{error}</p> : tooMany ? <p className="lab-note">Appending would exceed {MAX_LAB_VARIANTS} options. Reduce the steps, remove options, or replace the current list.</p> : <p className="lab-note">Append keeps all {variants.length} existing options. Replace builds a new list of {steps} options.</p>}
    </div>
  </details>
}

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

function LabResults({ result, variants, playerName }: { result: LabResult; variants: LabVariant[]; playerName: string }) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showPaths, setShowPaths] = useState(true)
  const [showEnds, setShowEnds] = useState(true)
  const shot = result.shots.find(entry => entry.plan.id === selectedId) ?? result.shots[0]
  if (!shot) return null
  const failures = [
    ['Ball not potted', shot.failures.misses], ['Wrong / no first contact', shot.failures.wrongContact], ['Wrong pocket', shot.failures.wrongPocket], ['Cue-ball scratch', shot.failures.scratch], ['Still moving at limit', shot.failures.unsettled],
  ] as const
  return <section className="lab-results" aria-labelledby="lab-results-heading">
    <div className="lab-section-heading"><div><span className="eyebrow">03 · OBSERVE THE DIFFERENCE</span><h2 id="lab-results-heading">Compare the ensembles.</h2></div><span className="lab-badge">{result.samples} trials / option</span></div>
    <p className="lab-note">Every option uses {playerName}’s precision and the same seeded stroke errors for a paired comparison. Success means contacting your chosen ball first, potting it in your chosen pocket, and settling without a scratch.</p>
    <div className="lab-comparison-scroll"><table className="lab-comparison" aria-label="Lab comparison"><thead><tr><th scope="col">Option</th><th scope="col">Success</th><th scope="col">Pot</th><th scope="col">Scratch</th><th scope="col">Cue spread</th></tr></thead><tbody>{result.shots.map((entry, index) => <tr key={entry.plan.id} className={entry.plan.id === shot.plan.id ? 'lab-comparison-selected' : ''}>
      <th scope="row"><button type="button" aria-label={`Inspect ${entry.plan.label}`} aria-pressed={entry.plan.id === shot.plan.id} onClick={() => setSelectedId(entry.plan.id)}><span className="lab-option-number">{String(index + 1).padStart(2, '0')}</span><span>{entry.plan.label}<small>Ball {entry.plan.ballId} → {POCKETS.find(pocket => pocket.id === entry.plan.pocketId)?.name}<br />{entry.plan.speed.toFixed(2)} m/s · draw/follow {entry.plan.topSpin.toFixed(2)}<br />Sidespin {entry.plan.sideSpin.toFixed(1)} rad/s · aim offset {(variants.find(variant => variant.id === entry.plan.id)?.settings.aimOffset ?? 0).toFixed(2)}°</small></span></button></th>
      <td><strong>{percent(entry.successRate)}</strong></td><td>{percent(entry.potRate)}</td><td>{percent(entry.scratchRate)}</td><td>{entry.sampleEnds.length ? `${(entry.spread * 100).toFixed(1)} cm` : 'n/a'}</td>
    </tr>)}</tbody></table></div>
    <p className="lab-note lab-comparison-note">Pot counts the chosen pocket with correct first contact; a pot can still scratch or fail to settle. Cue spread is the RMS distance from the mean finish among settled, non-scratch cue balls (n/a when there are none). These are simulated estimates; use more trials to investigate close differences.</p>
    <div className="lab-inspection-heading"><h3>{shot.plan.label} <span>· paths and finishes</span></h3><div className="lab-display-options"><label><input type="checkbox" checked={showPaths} onChange={event => setShowPaths(event.target.checked)} /> Trial paths</label><label><input type="checkbox" checked={showEnds} onChange={event => setShowEnds(event.target.checked)} /> Ball finishes</label></div></div>
    <EnsembleDiagram scenario={result.scenario} shot={shot} showPaths={showPaths} showEnds={showEnds} />
    <p className="lab-legend"><span><i className="lab-key-cue" /> Cue path</span><span><i className="lab-key-object" /> Successful object path</span><span><i className="lab-key-miss" /> Failed object path</span><span>Solid lines: intended stroke · Rings: trial finishes</span><span>{showPaths ? `${shot.samplePaths.length} cue paths and ${shot.sampleObjectPaths.length} object paths shown.` : 'Trial paths hidden.'}</span></p>
    <div className="lab-failures"><div><h3>What went wrong?</h3><p>Counts out of {shot.samples} trials. A trial can have more than one failure.</p></div><dl>{failures.map(([label, count]) => <div key={label}><dt>{label}</dt><dd>{count}<span> / {shot.samples}</span></dd></div>)}</dl></div>
  </section>
}

export default function LabMode({ character }: { character: PlayerCharacter }) {
  const [scenario, setScenario] = useState(() => createLabScenario(freshSeed()))
  const [variants, setVariants] = useState<LabVariant[]>(initialVariants)
  const [assistance, setAssistance] = useState<Record<string, ShotAssistance>>(() => Object.fromEntries(initialVariants().map(variant => [variant.id, freshAssistance()])))
  const [samples, setSamples] = useState(64)
  const [morph, setMorph] = useState<MorphSettings>(() => ({ start: { ...DEFAULT_LAB_SHOT_SETTINGS, speed: .7 }, end: { ...DEFAULT_LAB_SHOT_SETTINGS, speed: 2.1 }, steps: 5 }))
  const [result, setResult] = useState<LabResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const nextId = useRef(4)
  const version = useRef(0)
  const controller = useRef<AbortController | null>(null)
  const scenarioRef = useRef(scenario)
  const variantsRef = useRef(variants)
  const assistanceRef = useRef(assistance)
  const fitVersion = useRef(0)
  const fitController = useRef<AbortController | null>(null)
  const fitTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingFits = useRef(new Set<string>())
  const heading = useRef<HTMLHeadingElement>(null)
  const geometryError = validateSandboxLayout(scenario)
  const variantError = variants.map((variant, index) => {
    const invalid = settingsError(variant.settings) ?? (!scenario.balls.some(ball => ball.id === variant.settings.ballId && ball.id !== 0) ? `Ball ${variant.settings.ballId} is unavailable. Choose a ball on the table or unlock Ball and fit again.` : null)
    return invalid ? `Option ${index + 1}: ${invalid}` : null
  }).find(Boolean)
  const fitting = Object.values(assistance).some(value => value.status === 'queued' || value.status === 'fitting')

  useEffect(() => {
    heading.current?.focus({ preventScroll: true })
    queueFits(variantsRef.current.map(variant => variant.id))
    return () => { version.current += 1; controller.current?.abort(); cancelFitWork() }
  }, [])

  function invalidate() {
    version.current += 1
    controller.current?.abort()
    controller.current = null
    setBusy(false)
    setResult(null)
    setError(null)
    setNotice('')
  }

  function writeVariants(next: LabVariant[]) {
    variantsRef.current = next
    setVariants(next)
  }

  function writeAssistance(next: Record<string, ShotAssistance>) {
    assistanceRef.current = next
    setAssistance(next)
  }

  function patchAssistance(id: string, changes: Partial<ShotAssistance>) {
    const current = assistanceRef.current[id]
    if (current) writeAssistance({ ...assistanceRef.current, [id]: { ...current, ...changes } })
  }

  function cancelFitWork() {
    fitVersion.current += 1
    if (fitTimer.current !== null) clearTimeout(fitTimer.current)
    fitTimer.current = null
    fitController.current?.abort()
    fitController.current = null
  }

  // One debounced, sequential queue keeps dragging/editing responsive and prevents
  // old worker results from replacing a more recent value, lock, or layout.
  function queueFits(ids: string[], delay = 450) {
    cancelFitWork()
    ids.forEach(id => pendingFits.current.add(id))
    const nextAssistance = { ...assistanceRef.current }
    for (const id of pendingFits.current) {
      if (!nextAssistance[id] || !variantsRef.current.some(variant => variant.id === id)) { pendingFits.current.delete(id); continue }
      nextAssistance[id] = { ...nextAssistance[id], status: 'queued', message: 'Waiting to adapt unlocked values…' }
    }
    writeAssistance(nextAssistance)
    if (!pendingFits.current.size) return
    const requestVersion = fitVersion.current
    fitTimer.current = setTimeout(() => { fitTimer.current = null; void processFits(requestVersion) }, delay)
  }

  async function processFits(requestVersion: number) {
    for (const id of [...pendingFits.current]) {
      if (fitVersion.current !== requestVersion) return
      const variant = variantsRef.current.find(entry => entry.id === id)
      const current = assistanceRef.current[id]
      if (!variant || !current) { pendingFits.current.delete(id); continue }
      const layout = scenarioRef.current
      const invalid = validateSandboxLayout(layout) ?? settingsError(variant.settings, current.locks) ?? (current.locks.ballId && !layout.balls.some(ball => ball.id === variant.settings.ballId && ball.id !== 0) ? `Ball ${variant.settings.ballId} is unavailable. Choose another ball or unlock Ball.` : null)
      if (invalid) {
        pendingFits.current.delete(id)
        patchAssistance(id, { status: 'invalid', message: invalid })
        continue
      }
      const abort = new AbortController()
      fitController.current = abort
      patchAssistance(id, { status: 'fitting', message: 'Finding a playable stroke with your locked values…' })
      try {
        const fitted = await fitLabShotAsync({ scenario: layout, variant, locks: current.locks }, { signal: abort.signal })
        if (abort.signal.aborted || fitVersion.current !== requestVersion) return
        pendingFits.current.delete(id)
        if (fitted.status === 'found') {
          writeVariants(variantsRef.current.map(entry => entry.id === id ? { ...entry, settings: fitted.settings } : entry))
          patchAssistance(id, { status: 'found', message: `Playable stroke found. ${fitted.changed.length ? `Adapted ${fitted.changed.map(key => FIELD_NAMES[key]).join(', ')}.` : 'Current values work.'}` })
        } else {
          patchAssistance(id, { status: 'not-found', message: 'No playable stroke found with these locks. Try unlocking a value or moving a ball. Your settings are unchanged.' })
        }
      } catch (reason) {
        if (abort.signal.aborted || fitVersion.current !== requestVersion) return
        pendingFits.current.delete(id)
        patchAssistance(id, { status: 'not-found', message: reason instanceof Error ? reason.message : 'Could not fit this option. Try again.' })
      } finally {
        if (fitVersion.current === requestVersion) fitController.current = null
      }
    }
  }

  function changeLayout(nextScenario: Scenario) {
    invalidate()
    scenarioRef.current = nextScenario
    setScenario(nextScenario)
    writeAssistance(Object.fromEntries(Object.entries(assistanceRef.current).map(([id, value]) => [id, { ...value, status: 'idle', message: '' }])))
    queueFits(variantsRef.current.filter(variant => assistanceRef.current[variant.id].enabled).map(variant => variant.id))
  }

  function cancelFits() {
    cancelFitWork()
    pendingFits.current.clear()
    writeAssistance(Object.fromEntries(Object.entries(assistanceRef.current).map(([id, value]) => [id, value.status === 'queued' || value.status === 'fitting' ? { ...value, status: 'idle', message: 'Adaptation cancelled. Edit a value or fit again to resume.' } : value])))
  }

  function changeCount(count: number) {
    invalidate()
    try {
      const nextScenario = resizeLabBalls(scenario, count)
      const remaining = new Set(nextScenario.balls.map(ball => ball.id))
      const retarget = (settings: LabShotSettings) => remaining.has(settings.ballId) ? settings : { ...settings, ballId: 1 }
      writeVariants(variantsRef.current.map(variant => assistanceRef.current[variant.id].locks.ballId ? variant : { ...variant, settings: retarget(variant.settings) }))
      changeLayout(nextScenario)
      setMorph(previous => ({ ...previous, start: retarget(previous.start), end: retarget(previous.end) }))
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'The ball count could not be changed.') }
  }

  function updateVariant(id: string, changes: Partial<LabVariant>, field?: keyof LabShotSettings) {
    invalidate()
    writeVariants(variantsRef.current.map(variant => variant.id === id ? { ...variant, ...changes } : variant))
    if (field) {
      const current = assistanceRef.current[id]
      patchAssistance(id, { locks: { ...current.locks, [field]: true }, status: 'idle', message: '' })
      pendingFits.current.delete(id)
      queueFits(current.enabled ? [id] : [])
    }
  }

  function toggleLock(id: string, field: keyof LabShotSettings) {
    invalidate()
    const current = assistanceRef.current[id]
    patchAssistance(id, { locks: { ...current.locks, [field]: !current.locks[field] }, status: 'idle', message: '' })
    pendingFits.current.delete(id)
    queueFits(current.enabled ? [id] : [])
  }

  function toggleAuto(id: string) {
    invalidate()
    const current = assistanceRef.current[id]
    patchAssistance(id, { enabled: !current.enabled, status: 'idle', message: '' })
    pendingFits.current.delete(id)
    queueFits(current.enabled ? [] : [id])
  }

  function addVariant(source?: LabVariant) {
    if (variants.length >= MAX_LAB_VARIANTS) return
    invalidate()
    const number = nextId.current++
    const id = `lab-option-${number}`
    const sourceAssistance = source ? assistanceRef.current[source.id] : undefined
    const addedAssistance = freshAssistance(sourceAssistance?.enabled ?? true, { ...sourceAssistance?.locks })
    writeVariants([...variantsRef.current, { id, label: source ? `${source.label} copy` : `Option ${number}`, settings: { ...(source?.settings ?? DEFAULT_LAB_SHOT_SETTINGS) } }])
    writeAssistance({ ...assistanceRef.current, [id]: addedAssistance })
    queueFits(addedAssistance.enabled ? [id] : [])
  }

  function removeVariant(id: string) {
    invalidate()
    writeVariants(variantsRef.current.filter(variant => variant.id !== id))
    const nextAssistance = { ...assistanceRef.current }
    delete nextAssistance[id]
    writeAssistance(nextAssistance)
    pendingFits.current.delete(id)
    queueFits([])
  }

  function generateSteps(append: boolean) {
    if (morphValidation(morph) || (append && variants.length + morph.steps > MAX_LAB_VARIANTS)) return
    invalidate()
    try {
      const generated = generateLabVariants(morph.start, morph.end, morph.steps).map(variant => ({ ...variant, id: `lab-option-${nextId.current++}` }))
      const locks: LabShotLocks = { ballId: true, pocketId: true }
      for (const { key } of NUMERIC_FIELDS) if (morph.start[key] !== morph.end[key]) locks[key] = true
      writeVariants(append ? [...variantsRef.current, ...generated] : generated)
      writeAssistance({ ...(append ? assistanceRef.current : {}), ...Object.fromEntries(generated.map(variant => [variant.id, freshAssistance(false, { ...locks })])) })
      if (!append) pendingFits.current.clear()
      queueFits([])
      setNotice(`${morph.steps} editable options generated, including both endpoints. Auto-adapt is off; the target and varied values are locked so fitting preserves your steps.`)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'The steps could not be generated.') }
  }

  async function runEnsembles() {
    if (geometryError || variantError || busy || fitting) return
    invalidate()
    const runVersion = version.current
    const abort = new AbortController()
    controller.current = abort
    setBusy(true)
    try {
      const analysis = await analyzeLabAsync({ scenario, variants, samples, talents: character.talents }, { signal: abort.signal })
      if (abort.signal.aborted || version.current !== runVersion) return
      setResult(analysis)
      setNotice('Ensembles ready. Select an option below to inspect its paths and failures.')
    } catch (reason) {
      if (abort.signal.aborted || version.current !== runVersion) return
      setError(reason instanceof Error ? reason.message : 'The ensembles could not be calculated. Try again.')
    } finally {
      if (version.current === runVersion) { setBusy(false); controller.current = null }
    }
  }

  return <div className="lab-mode">
    <div className="lab-intro"><span className="eyebrow"><FlaskConical size={14} /> THE SHOT LAB</span><h2 ref={heading} tabIndex={-1}>Build your own experiment.</h2><p>Place the balls and start with playable strokes. Set the values you want to explore; auto-adapt adjusts the rest. Compare the ensembles to see which changes alter the odds.</p></div>
    <section className="lab-layout-section" aria-labelledby="lab-layout-heading">
      <div className="lab-layout-controls"><span className="eyebrow">01 · SET THE TABLE</span><h3 id="lab-layout-heading">A layout of your own.</h3><label className="lab-field" htmlFor="lab-ball-count"><span>Object balls</span><select id="lab-ball-count" value={scenario.balls.length - 1} onChange={event => changeCount(Number(event.target.value))}>{Array.from({ length: MAX_LAB_BALLS }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1} {index === 0 ? 'object ball' : 'object balls'}</option>)}</select></label><p className="lab-note">The white cue ball is always included. Place up to {MAX_LAB_BALLS} object balls anywhere clear of the cushions and each other.</p><Button type="button" variant="outline" size="sm" onClick={() => { changeLayout(resizeLabBalls(createLabScenario(freshSeed()), scenario.balls.length - 1)); setNotice('The layout has been reset. Your shot options are kept.') }}><RotateCcw size={14} /> Reset layout</Button><p className="lab-note">Shots do not need to be good to be tested. A miss, obstruction, or scratch can be the point of the experiment.</p></div>
      <div className="sandbox-editor lab-layout-editor"><BallLayoutEditor scenario={scenario} onChange={changeLayout} />{geometryError && <p className="lab-error" role="status">{geometryError}</p>}</div>
    </section>

    <section className="lab-options-section" aria-labelledby="lab-options-heading">
      <div className="lab-section-heading"><div><span className="eyebrow">02 · DESIGN YOUR STROKES</span><h2 id="lab-options-heading">Change one thing. Or everything.</h2></div><span className="lab-badge">{variants.length} / {MAX_LAB_VARIANTS} options</span></div>
      <div className="lab-auto-guide"><div><h3><Sparkles size={16} /> You set the constraints. Auto finds a stroke.</h3><p>Editing a value locks it. Use the locks to choose what auto can change, including the ball and pocket. Turn auto-adapt off for a fully manual experiment. A playable stroke succeeds in the intended simulation; run ensembles to measure its reliability.</p></div>{fitting ? <Button type="button" variant="outline" onClick={cancelFits}>Cancel adapting</Button> : <Button type="button" variant="outline" disabled={!!geometryError} onClick={() => { invalidate(); queueFits(variantsRef.current.map(variant => variant.id), 0) }}><Sparkles size={15} /> Auto-fit options</Button>}</div>
      <p className="lab-note">Strength is the cue ball’s launch speed. Draw / follow is the initial rolling-spin ratio: −1 adds backspin, 0 launches without forward or backspin, +1 is natural forward roll. The cloth changes that spin along the route. Positive sidespin adds left English. An aim offset of 0° points along the direct-pot line; positive angles turn clockwise on the table.</p>
      <div className="lab-options-grid">{variants.map((variant, index) => <ShotOptionEditor key={variant.id} scenario={scenario} variant={variant} assistance={assistance[variant.id]} index={index} canAdd={variants.length < MAX_LAB_VARIANTS} canRemove={variants.length > 1} onUpdate={(changes, field) => updateVariant(variant.id, changes, field)} onDuplicate={() => addVariant(variant)} onRemove={() => removeVariant(variant.id)} onToggleLock={field => toggleLock(variant.id, field)} onToggleAuto={() => toggleAuto(variant.id)} onFit={() => { invalidate(); queueFits([variant.id], 0) }} />)}</div>
      <Button type="button" variant="outline" disabled={variants.length >= MAX_LAB_VARIANTS} onClick={() => addVariant()}><Plus size={15} /> Add option</Button>

      <MorphEditor scenario={scenario} variants={variants} value={morph} onChange={value => { invalidate(); setMorph(value) }} onGenerate={generateSteps} />
      {variantError && <p className="lab-error" role="status">{variantError}</p>}
      <div className="lab-run"><div><label className="lab-field" htmlFor="lab-samples"><span>Trials per option</span><select id="lab-samples" value={samples} onChange={event => { invalidate(); setSamples(Number(event.target.value)) }}>{[32, 64, 128].map(count => <option key={count} value={count}>{count} trials</option>)}</select></label><p className="lab-note">Using {character.name}’s precision. More trials take longer. Editing the experiment cancels the current run and clears its results.</p></div><div className="lab-run-actions">{busy ? <><span className="lab-running" role="status"><LoaderCircle size={17} className="sandbox-spinner" /> Simulating {variants.length * samples} trials…</span><Button type="button" variant="outline" onClick={() => { invalidate(); setNotice('Run cancelled. Edit your options or run again.') }}>Cancel run</Button></> : <>{fitting && <span className="lab-running" role="status"><LoaderCircle size={17} className="sandbox-spinner" /> Adapting options…</span>}<Button type="button" disabled={!!geometryError || !!variantError || fitting} onClick={() => { void runEnsembles() }}><FlaskConical size={17} /> {error ? 'Retry ensembles' : 'Run ensembles'}</Button></>}</div></div>
      {error && <p className="lab-error" role="alert">{error}</p>}<p className="lab-run-notice" role="status" aria-live="polite">{notice}</p>
    </section>
    {result && <LabResults result={result} variants={variants} playerName={character.name} />}
  </div>
}
