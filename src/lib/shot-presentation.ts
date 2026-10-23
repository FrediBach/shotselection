import type { ShotPlan } from '@/engine/types'

export const percent = (value: number) => `${Math.round(value * 100)}%`
export const ENGLISH_EXPLANATION = 'English means side spin, separate from draw or follow. Left and right are viewed along the shot direction. It can change the cue ball’s rebound from a cushion. Amounts are launch rotation in rad/s, not cue-tip offset.'

export function verticalSpinDescription(plan: ShotPlan) {
  const spin = plan.topSpin < -0.1 ? 'Backspin' : plan.topSpin > 0.1 ? 'Topspin' : 'No draw / follow'
  const amount = Math.abs(plan.topSpin) > 0.1 ? ` ${Math.round(Math.abs(plan.topSpin) * 100)}%` : ''
  return `${spin}${amount}`
}

export function englishDescription(plan: ShotPlan) {
  if (plan.sideSpin === 0) return 'No English (no side spin)'
  const amount = Math.abs(plan.sideSpin)
  return `${plan.sideSpin > 0 ? 'Left' : 'Right'} English (side spin): ${amount < 0.05 ? '<0.1' : amount.toFixed(1)} rad/s`
}

export function strokeDescription(plan: ShotPlan) {
  return `${verticalSpinDescription(plan)} · ${englishDescription(plan)}`
}
