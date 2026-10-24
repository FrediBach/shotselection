import { expect, test } from '@playwright/test'
import { DEFAULT_CHARACTER } from '../src/engine/characters'
import { generateScenario } from '../src/engine/scenarios'
import { prepareRound } from '../src/engine/preparation'
import { simulateShot } from '../src/engine/physics'
import { analyzeSequences, sequenceLayout } from '../src/engine/sequence-reliability'
import { startLevel } from './helpers'

for (const mobile of [true, false]) test(`sequence reliability on ${mobile ? 'mobile' : 'desktop'}`, async ({ page }) => {
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1050 })
  await page.addInitScript(character => {
    localStorage.setItem('shot-selection-help-dismissed', 'true')
    localStorage.setItem('shot-selection-sound-enabled', 'false')
    localStorage.setItem('shot-selection-session', JSON.stringify({ character, scoringVersion: 2, courseVersion: 5, completedLessons: 38, level: 39, score: 0, rounds: 38, perfect: 0, seed: 0 }))
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function(type: string, ...args: unknown[]) { if (type === 'webgl2') return null; return original.call(this, type as '2d', ...args) } as typeof original
  }, DEFAULT_CHARACTER)
  const p = prepareRound(generateScenario(39, 39 * 919), { regenerate: false }), c = p.sequenceComparison!
  const reference = p.balls[0].options.find(o => o.id === c.referenceId)!
  const rates = analyzeSequences(sequenceLayout(p.scenario, simulateShot(p.scenario, reference.plan)), c.orders, p.scenario.objective!.maxCutAngle)
  const ranked = [...rates.orders].sort((a, b) => b.completed - a.completed)
  const name = (id: number) => id === 2 ? '2 → 3' : '3 → 2'
  const selected = mobile ? reference : p.balls[0].options.find(o => o.id !== reference.id)!
  await page.goto('/'); await startLevel(page, 39)
  await page.getByRole('button', { name: 'Select ball 1', exact: true }).click()
  await page.getByRole('button', { name: 'Choose a stroke', exact: true }).click()
  const panel = page.getByRole('region', { name: 'Sequence reliability', exact: true })
  const predictions = panel.getByRole('group', { name: 'Sequence prediction' })
  await expect(panel.getByRole('img')).toHaveCount(1)
  if (mobile) await predictions.getByRole('button', { name: `Order ${name(ranked[1].order.first.ballId)}`, exact: true }).click()
  await page.getByRole('button', { name: `Choose stroke ${selected.label}`, exact: true }).click()
  await page.getByRole('button', { name: 'Lock in your shot', exact: true }).click()
  await expect(panel.getByRole('img')).toHaveCount(5, { timeout: 30000 })
  await expect(panel.getByRole('status')).toContainText(mobile ? 'The first pot alone does not decide the order' : 'completes more often in this sample')
  await expect(panel).toContainText(mobile ? 'trials start at its nominal finish' : 'not your selected finish')
  for (const button of await predictions.getByRole('button').all()) await expect(button).toBeDisabled()
  for (const [i, rate] of rates.orders.entries()) {
    const branch = panel.locator('.sequence-rate-branch').nth(i)
    await expect(branch).toContainText(`First legal pots${rate.firstLegal}/128`)
    await expect(branch).toContainText(`Both pots completed${rate.completed}/128`)
    await expect(branch.getByRole('meter')).toHaveAttribute('value', String(rate.completed))
    await expect(branch.getByRole('img')).toHaveCount(2)
  }
  await expect(page.locator('.perfect-celebration')).toHaveCount(0, { timeout: 10000 })
  await panel.locator('.sequence-rate-branch').first().getByRole('heading').scrollIntoViewIfNeeded()
  await page.locator('.shot-panel').screenshot({ path: `/tmp/sequence-rates-${mobile ? 'mobile' : 'desktop'}.png` })
  await panel.getByRole('img', { name: `Order ${name(ranked[0].order.first.ballId)}: nominal second pot`, exact: true }).scrollIntoViewIfNeeded()
  await page.locator('.shot-panel').screenshot({ path: `/tmp/sequence-proof-${mobile ? 'mobile' : 'desktop'}.png` })
  await panel.getByRole('button', { name: 'Try the sequence prediction again', exact: true }).click()
  await expect(panel.getByRole('img')).toHaveCount(1)
  await predictions.getByRole('button', { name: `Order ${name(ranked[0].order.first.ballId)}`, exact: true }).click()
  await panel.getByRole('button', { name: 'Check sequence prediction', exact: true }).click()
  await expect(panel.getByRole('status')).toContainText('Your prediction matches the higher sampled completion rate')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'Next level', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Start level 40', exact: true })).toBeVisible()
  await expect(panel).toHaveCount(0)
})
