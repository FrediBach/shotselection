import type { CSSProperties } from 'react'

const colors: Record<number, string> = { 1: '#e9b14e', 2: '#6594d2', 3: '#db7466', 4: '#a68cce', 5: '#e59857', 6: '#71aa89', 7: '#b7747d', 8: '#787e79' }
export default function BallIcon({ id, small = false }: { id: number; small?: boolean }) {
  return <span className={`ball-icon ${small ? 'ball-small' : ''}`} style={{ '--ball-color': colors[id] || '#939f8b' } as CSSProperties}><span>{id}</span></span>
}
