import { POCKET_GEOMETRY } from '../engine/table-geometry'
import type { Ball, Simulation, Vec2 } from '../engine/types'

const points = (path: Vec2[]) => path.map(p => `${p.x},${p.y}`).join(' ')
export default function SequenceDiagram({ balls, label, simulation, oldKey, setupPoint }: { balls: Ball[]; label: string; simulation?: Simulation; oldKey?: Vec2; setupPoint?: Vec2 }) {
  const key = balls.find(ball => ball.id === 2)
  return <svg viewBox="-.08 -.08 2.70 1.43" role="img" aria-label={label}>
    <rect width="2.54" height="1.27" rx=".04" fill="#143f38" />
    {POCKET_GEOMETRY.map(p => <circle key={p.id} cx={p.center.x} cy={p.center.y} r=".045" fill="#071e1b" />)}
    {setupPoint && <path d={`M${setupPoint.x-.05},${setupPoint.y}h.1 M${setupPoint.x},${setupPoint.y-.05}v.1`} stroke="#ff9f98" strokeWidth=".012" />}
    {simulation && <>
      <polyline points={points(simulation.cuePath)} fill="none" stroke="#7de3ef" strokeWidth=".012" />
      <polyline points={points(simulation.objectPath)} fill="none" stroke="#ffc16e" strokeWidth=".012" />
      <circle cx={simulation.cueEnd.x} cy={simulation.cueEnd.y} r=".04" fill="none" stroke="#7de3ef" strokeWidth=".008" />
    </>}
    {oldKey && key && <>
      <line x1={oldKey.x} y1={oldKey.y} x2={key.position.x} y2={key.position.y} stroke="#ff9f98" strokeWidth=".009" strokeDasharray=".025 .02" />
      <circle cx={oldKey.x} cy={oldKey.y} r=".045" fill="none" stroke="#ff9f98" strokeWidth=".007" />
    </>}
    {balls.map(ball => <g key={ball.id}>
      <circle cx={ball.position.x} cy={ball.position.y} r=".03" fill={ball.id === 0 ? '#fff' : ball.id === 2 ? '#7de3ef' : '#ffc16e'} />
      <text x={ball.position.x} y={ball.position.y + .015} textAnchor="middle" fontSize=".045" fill="#071e1b">{ball.id || ''}</text>
    </g>)}
  </svg>
}

