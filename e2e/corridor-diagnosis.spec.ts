import { expect, test } from '@playwright/test'
import { DEFAULT_CHARACTER } from '../src/engine/characters'
import { generateScenario } from '../src/engine/scenarios'
import { prepareRound } from '../src/engine/preparation'
import { simulateShot } from '../src/engine/physics'
import { corridorPairFinder } from '../src/engine/corridor-diagnosis'
import { startLevel } from './helpers'

for (const mobile of [true, false]) test(`corridor diagnosis on ${mobile ? 'mobile' : 'desktop'}`, async ({ page }) => {
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1050 })
  await page.addInitScript(character => {
    localStorage.setItem('shot-selection-help-dismissed', 'true')
    localStorage.setItem('shot-selection-sound-enabled', 'false')
    localStorage.setItem('shot-selection-session', JSON.stringify({ character, scoringVersion: 2, courseVersion: 5, completedLessons: 36, level: 37, score: 0, rounds: 36, perfect: 0, seed: 0 }))
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function(type: string, ...args: unknown[]) { if (type === 'webgl2') return null; return original.call(this, type as '2d', ...args) } as typeof original
  }, DEFAULT_CHARACTER)
  const p = prepareRound(generateScenario(37, 37 * 919), { regenerate: false })
  const cases = corridorPairFinder(p.scenario)(p.balls[0].options.map(o => ({ plan: o.plan, simulation: simulateShot(p.scenario, o.plan) })))!.sort((a, b) => a.opening.plan.id.localeCompare(b.opening.plan.id))
  await page.goto('/'); await startLevel(page, 37)
  const panel = page.getByRole('region', { name: 'Corridor diagnosis', exact: true })
  const next = page.getByRole('button', { name: 'Choose a stroke', exact: true })
  await page.getByRole('button', { name: 'Select ball 1', exact: true }).click()
  await expect(next).toBeDisabled()
  await expect(panel.getByRole('img')).toHaveCount(2)
  for (const [i, c] of cases.entries()) {
    const answer = (c.evidence.corridor === 'approach') !== mobile ? 'Cue-ball approach' : 'Object-to-pocket line'
    await panel.getByRole('group', { name: `Case ${'AB'[i]} diagnosis` }).getByRole('button', { name: answer, exact: true }).click()
    if (i === 0) await expect(next).toBeDisabled()
  }
  await expect(next).toBeEnabled()
  await expect(panel.getByRole('status')).toHaveCount(2)
  for (const status of await panel.getByRole('status').all()) await expect(status).toContainText(mobile ? 'Check the other corridor.' : 'Correct.')
  for (const [i, c] of cases.entries()) {
    await panel.getByRole('button', { name: `Remove only ball ${c.evidence.blocker.id} in case ${'AB'[i]}`, exact: true }).click()
    await expect(panel).toContainText(`Counterfactual: only ball ${c.evidence.blocker.id} is removed.`)
    await panel.getByRole('img', { name: `Case ${'AB'[i]}: counterfactual with blocker removed`, exact: true }).scrollIntoViewIfNeeded()
    await page.locator('.shot-panel').screenshot({ path: `/tmp/corridor-${'AB'[i]}-${mobile ? 'mobile' : 'desktop'}.png` })
    await panel.getByRole('button', { name: 'Restore blocker', exact: true }).click()
  }
  await next.click()
  await page.getByRole('button', { name: 'Back to balls', exact: true }).click()
  await expect(panel.getByRole('status')).toHaveCount(2)
  await expect(next).toBeEnabled(); await next.click()
  const selected = p.balls[0].options.find(o => o.id === cases[mobile ? 0 : 1].opening.plan.id)!
  await page.getByRole('button', { name: `Choose stroke ${selected.label}`, exact: true }).click()
  await page.getByRole('button', { name: 'Lock in your shot', exact: true }).click()
  await expect(panel.getByLabel('Actual finish route counts')).toBeVisible({ timeout: 30000 })
  for (const group of await panel.getByRole('group').all()) for (const button of await group.getByRole('button').all()) await expect(button).toBeDisabled()
  await panel.getByRole('button', { name: 'Try the diagnosis again', exact: true }).click()
  for (const [i, c] of cases.entries()) await panel.getByRole('group', { name: `Case ${'AB'[i]} diagnosis` }).getByRole('button', { name: c.evidence.corridor === 'approach' ? 'Cue-ball approach' : 'Object-to-pocket line', exact: true }).click()
  for (const status of await panel.getByRole('status').all()) await expect(status).toContainText('Correct.')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'Next level', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Start level 38', exact: true })).toBeVisible()
  await expect(panel).toHaveCount(0)
})
