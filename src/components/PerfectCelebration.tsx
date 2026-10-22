import { useEffect, useRef, type CSSProperties } from 'react'
import { Trophy } from 'lucide-react'
import './PerfectCelebration.css'

const CELEBRATION_DURATION = 3000
const CONFETTI_COLORS = ['#e6bc80', '#b6c8a2', '#f2e9d7', '#c6995f']
const confetti = Array.from({ length: 30 }, (_, index) => {
  const angle = (index / 30) * Math.PI * 2
  const spread = 0.76 + (index % 4) * 0.08
  return {
    '--burst-x': `${Math.cos(angle) * 225 * spread}px`,
    '--burst-y': `${Math.sin(angle) * 155 * spread}px`,
    '--burst-turn': `${(index % 2 ? 1 : -1) * (150 + index * 27)}deg`,
    '--burst-delay': `${(index % 5) * 28}ms`,
    '--confetti-color': CONFETTI_COLORS[index % CONFETTI_COLORS.length],
  } as CSSProperties
})

export default function PerfectCelebration({ onComplete }: { onComplete: () => void }) {
  const complete = useRef(onComplete)
  useEffect(() => { complete.current = onComplete }, [onComplete])
  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let timer: number | undefined
    const update = () => {
      window.clearTimeout(timer)
      // Animated celebrations finish with their last painted frame, even if
      // the 3D scene needs time to redraw. The static alternative uses a timer.
      if (reducedMotion.matches) timer = window.setTimeout(() => complete.current(), CELEBRATION_DURATION)
    }
    update()
    reducedMotion.addEventListener('change', update)
    return () => { window.clearTimeout(timer); reducedMotion.removeEventListener('change', update) }
  }, [])

  return <div className="perfect-celebration" role="status" aria-live="polite" aria-atomic="true">
    <span className="perfect-celebration-announcement">Perfect choice! You earned 100 points.</span>
    <div className="perfect-celebration-art" aria-hidden="true">
      <div className="perfect-celebration-halo" />
      <div className="perfect-celebration-confetti">
        {confetti.map((style, index) => <i key={index} style={style} />)}
      </div>
      <div className="perfect-celebration-badge" onAnimationEnd={() => complete.current()}>
        <span className="perfect-celebration-trophy"><Trophy size={23} strokeWidth={1.5} /></span>
        <strong className="perfect-celebration-score">100</strong>
        <span className="perfect-celebration-label">Perfect choice</span>
        <span className="perfect-celebration-caption">Every point. Well earned.</span>
      </div>
    </div>
  </div>
}
