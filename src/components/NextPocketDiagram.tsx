import { POCKET_GEOMETRY } from '../engine/table-geometry'
import { TABLE } from '../engine/constants'
import type { DirectShotRoute } from '../engine/objectives'
import type { Ball } from '../engine/types'

export default function NextPocketDiagram({ balls, route, label, blocked, blockerId, cutTooLarge }: { balls: Ball[]; route: DirectShotRoute; label: string; blocked?: boolean; blockerId: number; cutTooLarge?: boolean }) {
  const cue = balls.find(b => b.id === 0)!, object = balls.find(b => b.id === 2)!, pocket = POCKET_GEOMETRY.find(p => p.id === route.pocketId)!
  return <svg viewBox="-.08 -.08 2.70 1.43" role="img" aria-label={label}>
    <rect width="2.54" height="1.27" rx=".04" fill="#143f38" />
    {POCKET_GEOMETRY.map(p => <circle key={p.id} cx={p.center.x} cy={p.center.y} r=".045" fill={p.id === pocket.id ? '#ffc16e' : '#071e1b'} />)}
    <line x1={cue.position.x} y1={cue.position.y} x2={route.ghost.x} y2={route.ghost.y} stroke="#7de3ef" strokeWidth=".012" strokeDasharray={cutTooLarge ? '.025 .02' : undefined} />
    <line x1={object.position.x} y1={object.position.y} x2={pocket.center.x} y2={pocket.center.y} stroke={blocked ? '#ff9f98' : '#ffc16e'} strokeWidth={TABLE.ballDiameter} strokeOpacity=".22" />
    <line x1={object.position.x} y1={object.position.y} x2={pocket.center.x} y2={pocket.center.y} stroke={blocked ? '#ff9f98' : '#ffc16e'} strokeWidth=".008" strokeDasharray={blocked ? '.025 .02' : undefined} />
    <circle cx={route.ghost.x} cy={route.ghost.y} r={TABLE.ballRadius} fill="none" stroke="#7de3ef" strokeWidth=".005" />
    {balls.map(b => <g key={b.id}>
      <circle cx={b.position.x} cy={b.position.y} r={TABLE.ballRadius} fill={b.id === 0 ? '#fff' : b.id === blockerId ? '#ff9f98' : '#ffc16e'} />
      <text x={b.position.x} y={b.position.y + .014} textAnchor="middle" fontSize=".043" fill="#071e1b">{b.id || ''}</text>
    </g>)}
  </svg>
}

