import type { ShotPlan } from '@/engine/types'

export const percent = (value: number) => `${Math.round(value * 100)}%`
export function strokeDescription(plan: ShotPlan) {
  const spin = plan.topSpin < -0.1 ? 'Backspin' : plan.topSpin > 0.1 ? 'Topspin' : 'Center ball'
  const amount = Math.abs(plan.topSpin) > 0.1 ? ` ${Math.round(Math.abs(plan.topSpin) * 100)}%` : ''
  const side = Math.abs(plan.sideSpin) > 0.1 ? ` · ${plan.sideSpin > 0 ? 'Left' : 'Right'} spin` : ''
  return `${spin}${amount}${side}`
}
