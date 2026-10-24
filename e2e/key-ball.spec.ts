import { expect, test } from '@playwright/test'
import { generateScenario } from '../src/engine/scenarios'
import { prepareRound } from '../src/engine/preparation'
import { simulateShot } from '../src/engine/physics'
import { keyBallEvidence } from '../src/engine/key-ball'
import { DEFAULT_CHARACTER } from '../src/engine/characters'
import { startLevel } from './helpers'

for (const mobile of [true, false]) test(`key-ball preservation on ${mobile ? 'mobile' : 'desktop'}`, async ({ page }) => {
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1050 })
  await page.addInitScript(character => {
    localStorage.setItem('shot-selection-help-dismissed', 'true')
    localStorage.setItem('shot-selection-sound-enabled', 'false')
    localStorage.setItem('shot-selection-session', JSON.stringify({ character, scoringVersion: 2, courseVersion: 5, completedLessons: 32, level: 33, score: 0, rounds: 32, perfect: 0, seed: 0 }))
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function(type: string, ...args: unknown[]) { if (type === 'webgl2') return null; return original.call(this, type as '2d', ...args) } as typeof original
  }, DEFAULT_CHARACTER)
  const p = prepareRound(generateScenario(33, 33 * 919), { regenerate: false })
  const choices = p.balls[0].options.map(option => ({ option, check: keyBallEvidence(p.scenario, option.plan, simulateShot(p.scenario, option.plan)) }))
  const kept = choices.find(c => c.check.kept)!, lost = choices.find(c => c.check.lost)!
  const choice = mobile ? lost : kept
  await page.goto('/'); await startLevel(page, 33)
  await page.getByRole('button', { name: 'Select ball 1', exact: true }).click()
  await page.getByRole('button', { name: 'Choose a stroke', exact: true }).click()
  const comparison = page.getByRole('region', { name: 'Key-ball preservation', exact: true })
  const predictions = comparison.getByRole('group', { name: 'Key-ball prediction' })
  await expect(comparison.getByRole('img')).toHaveCount(0)
  if (mobile) await predictions.getByRole('button', { name: `Stroke ${choice.option.label}`, exact: true }).click()
  await page.getByRole('button', { name: `Choose stroke ${choice.option.label}`, exact: true }).click()
  await page.getByRole('button', { name: 'Lock in your shot', exact: true }).click()
  await expect(comparison.getByRole('img')).toHaveCount(4, { timeout: 30000 })
  await expect(comparison).toContainText(mobile ? 'displaces the key ball and loses the connection' : 'preserves a verified 1 → 2 → 3 continuation')
  await expect(comparison.getByRole('status')).toContainText(mobile ? 'Compare the two continuations' : 'Compare the preserved and displaced key ball')
  for (const button of await predictions.getByRole('button').all()) await expect(button).toBeDisabled()
  await comparison.getByRole('button', { name: 'Why did the connection disappear?' }).click()
  await expect(comparison.getByRole('img')).toHaveCount(5)
  await expect(comparison).toContainText('restore only ball 2')
  await expect(comparison).toContainText('not the actual result')
  await expect(page.locator('.perfect-celebration')).toHaveCount(0, { timeout: 10000 })
  await comparison.getByRole('heading', { name: 'Keep the link to ball 3.', exact: true }).scrollIntoViewIfNeeded()
  await page.locator('.shot-panel').screenshot({ path: `/tmp/key-ball-${mobile ? 'mobile' : 'desktop'}.png` })
  await comparison.getByRole('img', { name: 'Simulated second shot from the preserved opening finish', exact: true }).scrollIntoViewIfNeeded()
  await page.locator('.shot-panel').screenshot({ path: `/tmp/key-ball-continuation-${mobile ? 'mobile' : 'desktop'}.png` })
  await comparison.getByRole('button', { name: 'Try the prediction again' }).click()
  await expect(comparison.getByRole('img')).toHaveCount(0)
  await predictions.getByRole('button', { name: `Stroke ${kept.option.label}`, exact: true }).click()
  await comparison.getByRole('button', { name: 'Check prediction', exact: true }).click()
  await expect(comparison.getByRole('status')).toContainText('Your prediction preserves')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'Next level', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Start level 34', exact: true })).toBeVisible()
  await expect(comparison).toHaveCount(0)
})
