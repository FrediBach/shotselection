import { ChevronDown, Wrench } from 'lucide-react'
import type { TableConditions as Conditions, Vec2 } from '../engine/types'
import './TableConditions.css'

function driftDirection(nap: Vec2) {
  const horizontal = Math.abs(nap.x) > Math.abs(nap.y) * 0.35 ? (nap.x > 0 ? 'right' : 'left') : ''
  const vertical = Math.abs(nap.y) > Math.abs(nap.x) * 0.35 ? (nap.y > 0 ? 'bottom' : 'top') : ''
  return [vertical, horizontal].filter(Boolean).join(' ')
}

/** These describe the declared physics, without revealing a candidate's result. */
export function conditionNotes(conditions: Conditions) {
  const notes: { label: string; detail: string }[] = []
  if (conditions.cloth && conditions.cloth !== 1) notes.push({
    label: conditions.cloth > 1 ? 'Slow cloth' : 'Slick cloth',
    detail: `${conditions.cloth.toFixed(1)}× cloth drag. ${conditions.cloth > 1 ? 'Balls lose speed sooner; allow for the whole journey after contact.' : 'Balls carry farther; judge the stopping distance as well as the pot.'}`,
  })
  if (conditions.nap && Math.hypot(conditions.nap.x, conditions.nap.y) > 0) notes.push({
    label: 'Uneven surface',
    detail: `Moving balls drift toward the ${driftDirection(conditions.nap)} of the table, in the arrow’s direction. Longer travel gives the drift more time to act.`,
  })
  if (conditions.patches?.length) {
    const sticky = conditions.patches.some(patch => patch.friction > 1)
    const slick = conditions.patches.some(patch => patch.friction < 1)
    notes.push({
      label: sticky && slick ? 'Mismatched repairs' : slick ? 'Slick repairs' : 'Sticky patches',
      detail: `${sticky ? 'Amber hatched circles add drag. ' : ''}${slick ? 'Pale blue circles reduce drag. ' : ''}Their edges match the affected areas; compare how much of each route crosses them.`,
    })
  }
  if (conditions.cushions?.length) notes.push({
    label: 'Dead cushions',
    detail: `The ${conditions.cushions.map(cushion => cushion.rail).join(' and ')} cushion${conditions.cushions.length === 1 ? ' has' : 's have'} a weaker rebound. Amber stripes identify the affected rails.`,
  })
  if (conditions.cue) {
    const parts = []
    if (conditions.cue.power !== 1) parts.push(`only ${Math.round(conditions.cue.power * 100)}% of the requested speed reaches the ball`)
    if (conditions.cue.angleBias) parts.push(`the strike veers ${(Math.abs(conditions.cue.angleBias) * 180 / Math.PI).toFixed(1)}° ${conditions.cue.angleBias > 0 ? 'right' : 'left'} of the intended aim`)
    if (conditions.cue.spin !== 1) parts.push(`the tip delivers ${Math.round(conditions.cue.spin * 100)}% of the requested spin`)
    if (parts.length) notes.push({ label: 'Bad cue', detail: `${parts.join('; ')}. Stroke settings show the request before these equipment losses.` })
  }
  if (conditions.dirt) notes.push({ label: 'Dirty balls', detail: 'Grimy balls lose more speed and grip each other more at contact. Read the cut and the cue-ball finish together.' })
  return notes
}

export function TableConditionDetails({ conditions }: { conditions: Conditions }) {
  return <ul className="table-condition-details">{conditionNotes(conditions).map(note => <li key={note.label}><strong>{note.label}</strong><span>{note.detail}</span></li>)}</ul>
}

export function TableConditionSummary({ conditions, finalBoss = false }: { conditions: Conditions; finalBoss?: boolean }) {
  const notes = conditionNotes(conditions)
  return <details className="table-condition-summary" key={conditions.id}>
    <summary aria-label={`Table conditions: ${conditions.name}. Show defects and their effects.`}>
      <Wrench size={14} aria-hidden="true" />
      <span className="table-condition-summary-title"><strong>{finalBoss ? 'FINAL BOSS' : 'TABLE REPORT'}</strong><span>{conditions.name}</span></span>
      <span className="table-condition-count">{notes.length} {notes.length === 1 ? 'defect' : 'defects'}</span>
      <ChevronDown className="table-condition-chevron" size={14} aria-hidden="true" />
    </summary>
    <div className="table-condition-popover"><p>{conditions.description}</p><TableConditionDetails conditions={conditions} /></div>
  </details>
}

export function TableConditionBriefing({ conditions, finalBoss = false }: { conditions: Conditions; finalBoss?: boolean }) {
  return <section className="table-condition-briefing" aria-label="Table defects">
    <div className="table-condition-heading"><Wrench size={16} aria-hidden="true" /><span>{finalBoss ? 'THE FINAL BOSS' : 'OUT OF ORDER. STILL IN PLAY.'}</span></div>
    <h3>{conditions.name}</h3>
    <p>{conditions.description}</p>
    <TableConditionDetails conditions={conditions} />
  </section>
}
