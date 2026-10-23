import { useEffect, useRef, useState } from 'react'
import { analyzeShotToleranceAsync } from '@/engine'
import type { Scenario, ShotAnalysis, ShotTolerance } from '@/engine/types'

/** Cache this round's margins and cancel unfinished work when inspection changes. */
export function useShotTolerances(scenario: Scenario, shot: ShotAnalysis, best: ShotAnalysis) {
  const cache = useRef(new Map<string, ShotTolerance>())
  const [analyses, setAnalyses] = useState<Record<string, ShotTolerance>>({})
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const inspected = analyses[shot.plan.id]
  const ideal = analyses[best.plan.id]
  const loading = !error && (!inspected || !ideal)

  useEffect(() => {
    const controller = new AbortController()
    setError('')
    async function calculate() {
      try {
        for (const candidate of [shot, best]) {
          if (cache.current.has(candidate.plan.id)) continue
          const analysis = await analyzeShotToleranceAsync(scenario, candidate.plan, { signal: controller.signal })
          if (controller.signal.aborted) return
          cache.current.set(candidate.plan.id, analysis)
          setAnalyses(previous => ({ ...previous, [candidate.plan.id]: analysis }))
        }
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'The margins could not be calculated.')
      }
    }
    void calculate()
    return () => controller.abort()
  }, [scenario, shot, best, attempt])

  const retry = () => setAttempt(previous => previous + 1)
  return { inspected, ideal, loading, error, retry }
}
