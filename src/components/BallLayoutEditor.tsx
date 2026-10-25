import { useState } from 'react'
import { TABLE } from '../engine/constants'
import type { Scenario, Vec2 } from '../engine/types'
import PoolTable from './PoolTable'

const BALL_COLORS = ['#f4f1e7', '#e9b14e', '#6594d2', '#db7466', '#a68cce', '#e59857', '#71aa89', '#b7747d', '#787e79']
const ballName = (id: number) => id === 0 ? 'Cue ball' : `Ball ${id}`
const centimeters = (value: number) => Number((value * 100).toFixed(2))

function CoordinateInput({ axis, value, onChange }: { axis: 'x' | 'y'; value: number; onChange: (value: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null)
  return <label htmlFor={`sandbox-ball-${axis}`}><span>{axis.toUpperCase()}</span><input id={`sandbox-ball-${axis}`} type="number" min={0} max={(axis === 'x' ? TABLE.length : TABLE.width) * 100} step="0.1" value={draft ?? centimeters(value)} onBlur={() => setDraft(null)} onChange={event => {
    setDraft(event.target.value)
    const nextValue = event.target.valueAsNumber
    if (Number.isFinite(nextValue)) onChange(nextValue / 100)
  }} /><span>cm</span></label>
}

/** The same accessible position editor serves scenario and free lab layouts. */
export default function BallLayoutEditor({ scenario, onChange, editable = true }: {
  scenario: Scenario
  onChange: (scenario: Scenario) => void
  editable?: boolean
}) {
  const [selectedBallId, setSelectedBallId] = useState(0)
  const selectedBall = scenario.balls.find(ball => ball.id === selectedBallId) ?? scenario.balls[0]

  function moveBall(ballId: number, position: Vec2) {
    const fixedObjective = scenario.authoring?.fixedObjective ?? Boolean(scenario.authoring?.imported);
    onChange({ ...scenario,
      balls: scenario.balls.map(ball => ball.id === ballId ? { ...ball, position } : ball),
      authoring: { ...(scenario.authoring ?? { id: `custom-${scenario.level}`, kind: 'draft' }),
        variation: { mirrorX: false, mirrorY: false }, imported: true, fixedObjective },
      ...(scenario.objective && !fixedObjective ? { objective: { ...scenario.objective, target: undefined, regions: undefined } } : {}),
    })
  }

  return <>
        <div className="sandbox-table-wrap">
          <div className="sandbox-table" role={editable ? undefined : 'img'} aria-label={editable ? undefined : 'Sandbox ball layout'} aria-describedby={editable ? undefined : 'sandbox-table-description'}>
            <PoolTable scenario={scenario} selectedBall={editable ? selectedBall?.id ?? null : null} target={null} onSelectBall={setSelectedBallId}
              finishOptions={[]} approachOption={null} selectedOptionId={null} onSelectOption={() => {}} selectableBallIds={[]}
              analysis={null} showEnsemble={false} showFinishes={false} playing={false} playbackKey={0} onPlaybackEnd={() => {}} interactive={false}
              placementControls={editable ? { onMoveBall: moveBall, describedBy: 'sandbox-table-instructions sandbox-table-description' } : undefined} />
          </div>
          <p id="sandbox-table-description" className="sr-only">{scenario.balls.map(ball => `${ballName(ball.id)} at ${centimeters(ball.position.x)} centimeters from the left and ${centimeters(ball.position.y)} centimeters from the top`).join('. ')}.</p>
        </div>
        {editable && <div className="sandbox-ball-editor">
          <p id="sandbox-table-instructions">Select a ball, then tap the table or drag it. Focus the table and use arrow keys to move 1 cm; hold Shift for 1 mm.</p>
          <div className="sandbox-ball-picker" role="group" aria-label="Ball to place">{scenario.balls.map(ball => <button type="button" key={ball.id} aria-label={`Place ${ballName(ball.id).toLowerCase()}`} aria-pressed={selectedBall?.id === ball.id} onClick={() => setSelectedBallId(ball.id)}><span style={{ background: BALL_COLORS[ball.id > 8 ? ball.id - 8 : ball.id] }}>{ball.id === 0 ? '' : ball.id}</span>{ball.id === 0 && <span>Cue</span>}</button>)}</div>
          {selectedBall && <div className="sandbox-coordinates"><span>{ballName(selectedBall.id)}<small>Position from the top left</small></span>{(['x', 'y'] as const).map(axis => <CoordinateInput key={`${selectedBall.id}-${axis}`} axis={axis} value={selectedBall.position[axis]} onChange={value => moveBall(selectedBall.id, { ...selectedBall.position, [axis]: value })} />)}</div>}
        </div>}
  </>
}
