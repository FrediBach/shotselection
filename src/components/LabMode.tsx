import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { CircleHelp, Copy, FlaskConical, Layers3, LoaderCircle, LockKeyhole, Plus, RotateCcw, SlidersHorizontal, Sparkles, Trash2, UnlockKeyhole } from 'lucide-react'
import { analyzeLabAsync, fitLabShotAsync } from '../engine/client'
import { POCKETS } from '../engine/constants'
import { createLabScenario, DEFAULT_LAB_SHOT_SETTINGS, generateLabVariants, LAB_SHOT_LIMITS, MAX_LAB_BALLS, MAX_LAB_VARIANTS, resizeLabBalls } from '../engine/lab'
import type { LabResult, LabShotSettings, LabVariant } from '../engine/lab'
import type { LabShotLocks } from '../engine/lab-auto'
import { validateSandboxLayout } from '../engine/sandbox'
import type { PlayerCharacter, Scenario } from '../engine/types'
import BallLayoutEditor from './BallLayoutEditor'
import LabResults from './LabResults'
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from './ui/dialog'
import { Button } from './ui/button'
import './LabMode.css'

type NumericSetting = 'speed' | 'topSpin' | 'sideSpin' | 'aimOffset'
const NUMERIC_FIELDS: { key: NumericSetting; label: string }[] = [
  { key: 'speed', label: 'Strength (m/s)' },
  { key: 'topSpin', label: 'Draw / follow' },
  { key: 'sideSpin', label: 'Sidespin (rad/s)' },
  { key: 'aimOffset', label: 'Aim offset (°)' },
]
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
  return <div className="lab-morph">
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
  </div>
}

export default function LabMode({ character, modeSwitcher }: { character: PlayerCharacter; modeSwitcher: ReactNode }) {
  const [scenario, setScenario] = useState(() => createLabScenario(freshSeed()))
  const [variants, setVariants] = useState<LabVariant[]>(initialVariants)
  const [assistance, setAssistance] = useState<Record<string, ShotAssistance>>(() => Object.fromEntries(initialVariants().map(variant => [variant.id, freshAssistance()])))
  const [samples, setSamples] = useState(64)
  const [morph, setMorph] = useState<MorphSettings>(() => ({ start: { ...DEFAULT_LAB_SHOT_SETTINGS, speed: .7 }, end: { ...DEFAULT_LAB_SHOT_SETTINGS, speed: 2.1 }, steps: 5 }))
  const [result, setResult] = useState<LabResult | null>(null)
  const [stale, setStale] = useState(false)
  const [selectedId, setSelectedId] = useState('lab-option-1')
  const [inspectedId, setInspectedId] = useState('lab-option-1')
  const [dialog, setDialog] = useState<'layout' | 'morph' | 'guide' | null>(null)
  const [mobileView, setMobileView] = useState<'edit' | 'results'>('edit')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const selectedIdRef = useRef(selectedId)
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
  const optionPicker = useRef<HTMLDivElement>(null)
  const pendingEditorFocus = useRef<string | null>(null)
  const selectedIndex = Math.max(0, variants.findIndex(variant => variant.id === selectedId))
  const selected = variants[selectedIndex]
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

  useEffect(() => {
    const picker = optionPicker.current
    const button = picker?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')
    if (picker && button) {
      const pickerBounds = picker.getBoundingClientRect()
      const buttonBounds = button.getBoundingClientRect()
      if (buttonBounds.top < pickerBounds.top) picker.scrollTop -= pickerBounds.top - buttonBounds.top
      else if (buttonBounds.bottom > pickerBounds.bottom) picker.scrollTop += buttonBounds.bottom - pickerBounds.bottom
    }
    if (pendingEditorFocus.current === selected.id) {
      document.getElementById(`${selected.id}-name`)?.focus({ preventScroll: true })
      pendingEditorFocus.current = null
    }
  }, [selected.id])

  function selectVariant(id: string) {
    selectedIdRef.current = id
    setSelectedId(id)
    if (result?.shots.some(shot => shot.plan.id === id)) setInspectedId(id)
  }

  function invalidate() {
    version.current += 1
    controller.current?.abort()
    controller.current = null
    setBusy(false)
    setStale(true)
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
    pendingEditorFocus.current = id
    selectVariant(id)
    setMobileView('edit')
    queueFits(addedAssistance.enabled ? [id] : [])
  }

  function removeVariant(id: string) {
    if (variantsRef.current.length <= 1) return
    invalidate()
    const index = variantsRef.current.findIndex(variant => variant.id === id)
    if (id === selected.id) {
      const nextSelectedId = variantsRef.current[index + 1]?.id ?? variantsRef.current[index - 1].id
      pendingEditorFocus.current = nextSelectedId
      selectVariant(nextSelectedId)
    }
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
      selectVariant(generated[0].id)
      setMobileView('edit')
      setDialog(null)
      setNotice(`${morph.steps} options generated. Auto-adapt is off; the target and varied values are locked.`)
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
      setInspectedId(selectedIdRef.current)
      setStale(false)
      setMobileView('results')
      setNotice('Ensembles ready. Select an option to compare its results.')
    } catch (reason) {
      if (abort.signal.aborted || version.current !== runVersion) return
      setError(reason instanceof Error ? reason.message : 'The ensembles could not be calculated. Try again.')
    } finally {
      if (version.current === runVersion) { setBusy(false); controller.current = null }
    }
  }

  return <div className="lab-mode">
    <div className="lab-workspace-heading">
      <div><h2 ref={heading} tabIndex={-1}><FlaskConical size={21} /> Shot lab</h2><p>Adjust a stroke. Run it. Compare the odds.</p></div>
      {modeSwitcher}
      <div className="lab-workspace-tools">
        <Dialog open={dialog === 'layout'} onOpenChange={open => setDialog(open ? 'layout' : null)}>
          <DialogTrigger asChild><Button type="button" variant="outline" size="sm"><SlidersHorizontal size={15} /> Edit layout</Button></DialogTrigger>
          <DialogContent className="lab-dialog lab-layout-dialog">
            <DialogTitle>Table layout</DialogTitle>
            <DialogDescription>Move the balls to set up your experiment. Changes apply immediately.</DialogDescription>
            <div className="lab-layout-toolbar"><label className="lab-field" htmlFor="lab-ball-count"><span>Object balls</span><select id="lab-ball-count" value={scenario.balls.length - 1} onChange={event => changeCount(Number(event.target.value))}>{Array.from({ length: MAX_LAB_BALLS }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1} {index === 0 ? 'object ball' : 'object balls'}</option>)}</select></label><Button type="button" variant="outline" size="sm" onClick={() => { changeLayout(resizeLabBalls(createLabScenario(freshSeed()), scenario.balls.length - 1)); setNotice('The layout has been reset. Your shot options are kept.') }}><RotateCcw size={14} /> Reset layout</Button></div>
            <div className="sandbox-editor lab-layout-editor"><BallLayoutEditor scenario={scenario} onChange={changeLayout} /></div>
            {geometryError && <p className="lab-error" role="status">{geometryError}</p>}
            <div className="lab-dialog-footer"><span>The cue ball is always included.</span><Button type="button" onClick={() => setDialog(null)}>Done</Button></div>
          </DialogContent>
        </Dialog>
        <Dialog open={dialog === 'morph'} onOpenChange={open => setDialog(open ? 'morph' : null)}>
          <DialogTrigger asChild><Button type="button" variant="outline" size="sm" aria-label="Morph between two strokes"><Layers3 size={15} /> Morph strokes</Button></DialogTrigger>
          <DialogContent className="lab-dialog lab-morph-dialog">
            <DialogTitle>Morph between two strokes</DialogTitle>
            <DialogDescription>Build a series of evenly spaced options between two strokes.</DialogDescription>
            <MorphEditor scenario={scenario} variants={variants} value={morph} onChange={setMorph} onGenerate={generateSteps} />
          </DialogContent>
        </Dialog>
        <Dialog open={dialog === 'guide'} onOpenChange={open => setDialog(open ? 'guide' : null)}>
          <DialogTrigger asChild><Button type="button" variant="ghost" size="icon" aria-label="Lab guide" title="Lab guide"><CircleHelp size={18} /></Button></DialogTrigger>
          <DialogContent className="lab-dialog lab-guide-dialog">
            <DialogTitle>Lab guide</DialogTitle>
            <DialogDescription>Set up an experiment, vary your strokes, and compare their reliability.</DialogDescription>
            <h3>Set the constraints. Auto finds a stroke.</h3><p>Editing a value locks it. Use the locks to choose what auto can change, including the ball and pocket. Turn auto-adapt off for a fully manual experiment. A playable stroke succeeds in the intended simulation; run ensembles to measure its reliability.</p>
            <h3>Know your controls</h3><dl className="lab-guide-fields"><div><dt>Strength</dt><dd>The cue ball’s launch speed in meters per second.</dd></div><div><dt>Draw / follow</dt><dd>The initial rolling-spin ratio: −1 adds backspin, 0 has no forward or backspin, +1 is natural forward roll. The cloth changes spin along the route.</dd></div><div><dt>Sidespin</dt><dd>Positive values add left English, in radians per second.</dd></div><div><dt>Aim offset</dt><dd>0° points along the direct-pot line. Positive angles turn clockwise on the table.</dd></div></dl>
            <h3>Experiment freely</h3><p>A miss, obstruction, or scratch can be the point of the experiment. Each option uses {character.name}’s precision and the same seeded errors for a paired comparison. More trials help investigate close differences.</p><p>Edits cancel an active run. Previous results stay visible until you run again. Use the arrow keys in the result inspector to step through options.</p>
          </DialogContent>
        </Dialog>
      </div>
    </div>
    <div className="lab-run">
      <div className="lab-run-summary"><span className="lab-badge">{variants.length} options · {scenario.balls.length - 1} {scenario.balls.length === 2 ? 'ball' : 'balls'}</span><span>{character.name}’s precision</span></div>
      <div className="lab-run-actions"><label className="lab-field" htmlFor="lab-samples"><span>Trials per option</span><select id="lab-samples" value={samples} onChange={event => { invalidate(); setSamples(Number(event.target.value)) }}>{[32, 64, 128].map(count => <option key={count} value={count}>{count} trials</option>)}</select></label>{busy ? <><span className="lab-running" role="status"><LoaderCircle size={15} className="sandbox-spinner" /> {variants.length * samples} trials…</span><Button type="button" variant="outline" onClick={() => { invalidate(); setNotice('Run cancelled. Edit your options or run again.') }}>Cancel run</Button></> : <Button type="button" disabled={!!geometryError || !!variantError || fitting} onClick={() => { void runEnsembles() }}>{fitting ? <LoaderCircle size={16} className="sandbox-spinner" /> : <FlaskConical size={16} />} {error ? 'Retry ensembles' : 'Run ensembles'}</Button>}</div>
    </div>
    <div className="lab-feedback" aria-live="polite">{error ? <p className="lab-error" role="alert">{error}</p> : geometryError ? <p className="lab-error">{geometryError} Open Edit layout to fix it.</p> : variantError ? <p className="lab-error">{variantError}</p> : <p className="lab-run-notice" role="status">{busy ? 'Simulating your strokes… You can keep editing to cancel this run.' : fitting ? 'Adapting unlocked values…' : notice || 'Ready to experiment. Editing a value locks it; auto adapts the rest.'}</p>}</div>
    <div className="lab-mobile-navigation" role="group" aria-label="Lab workspace view"><button type="button" aria-pressed={mobileView === 'edit'} onClick={() => setMobileView('edit')}>Edit strokes</button><button type="button" aria-pressed={mobileView === 'results'} onClick={() => setMobileView('results')}>{result ? 'View results' : 'View table'}{result && stale && <span> · Previous run</span>}</button></div>
    <div className="lab-workspace" data-mobile-view={mobileView}>
      <section className="lab-options-section" aria-labelledby="lab-options-heading">
        <div className="lab-section-heading"><h3 id="lab-options-heading">Shot options <span>{variants.length}/{MAX_LAB_VARIANTS}</span></h3><Button type="button" variant="ghost" size="sm" disabled={variants.length >= MAX_LAB_VARIANTS} onClick={() => addVariant()}><Plus size={15} /> Add option</Button></div>
        <div ref={optionPicker} className="lab-option-picker" role="group" aria-label="Choose a shot option">{variants.map((variant, index) => <button type="button" key={variant.id} aria-label={`Edit option ${index + 1}: ${variant.label}`} aria-pressed={selected.id === variant.id} onClick={() => selectVariant(variant.id)}><span>{String(index + 1).padStart(2, '0')}</span><span>{variant.label || `Option ${index + 1}`}</span></button>)}</div>
        <ShotOptionEditor key={selected.id} scenario={scenario} variant={selected} assistance={assistance[selected.id]} index={selectedIndex} canAdd={variants.length < MAX_LAB_VARIANTS} canRemove={variants.length > 1} onUpdate={(changes, field) => updateVariant(selected.id, changes, field)} onDuplicate={() => addVariant(selected)} onRemove={() => removeVariant(selected.id)} onToggleLock={field => toggleLock(selected.id, field)} onToggleAuto={() => toggleAuto(selected.id)} onFit={() => { invalidate(); queueFits([selected.id], 0) }} />
        <div className="lab-batch-actions">{fitting ? <Button type="button" variant="ghost" size="sm" onClick={cancelFits}><LoaderCircle size={14} className="sandbox-spinner" /> Cancel adapting</Button> : <Button type="button" variant="ghost" size="sm" disabled={!!geometryError} onClick={() => { invalidate(); queueFits(variantsRef.current.map(variant => variant.id), 0) }}><Sparkles size={14} /> Auto-fit options</Button>}<span>Applies to all {variants.length}</span></div>
      </section>
      <div className="lab-results-panel">
        {result ? <LabResults result={result} selectedId={inspectedId} onSelect={id => { setInspectedId(id); if (variants.some(variant => variant.id === id)) selectVariant(id) }} stale={stale} /> : <section className="lab-preview" aria-label="Experiment preview"><div className="lab-section-heading"><h3>Your table</h3><span className="lab-badge">9 ft · {scenario.balls.length - 1} object {scenario.balls.length === 2 ? 'ball' : 'balls'}</span></div>{dialog !== 'layout' ? <BallLayoutEditor scenario={scenario} onChange={changeLayout} editable={false} /> : <div className="lab-table-placeholder" />}<div className="lab-preview-note"><FlaskConical size={22} /><h3>A small change can change the odds.</h3><p>Choose a stroke on the left, then run the ensembles.<br />Compare success rates and see every path here.</p></div></section>}
      </div>
    </div>
  </div>
}
