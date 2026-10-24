import { expect, test } from '@playwright/test'
import { DEFAULT_CHARACTER } from '../src/engine/characters'
import { prepareRound } from '../src/engine/preparation'
import { generateScenario } from '../src/engine/scenarios'
import { simulateShot } from '../src/engine/physics'
import { kickIntroductionEvidence } from '../src/engine/kick-introduction'
import { startLevel } from './helpers'

for (const mobile of [true, false]) test(`introduce kick rebound on ${mobile ? 'mobile' : 'desktop'}`, async ({ page }) => {
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1050 })
  await page.addInitScript(character => {
    localStorage.setItem('shot-selection-help-dismissed', 'true')
    localStorage.setItem('shot-selection-sound-enabled', 'false')
    localStorage.setItem('shot-selection-session', JSON.stringify({ character, scoringVersion: 2, courseVersion: 5, completedLessons: 50, level: 51, score: 0, rounds: 50, perfect: 0, seed: 0 }))
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function(type: string, ...args: unknown[]) { if (type === 'webgl2') return null; return original.call(this, type as '2d', ...args) } as typeof original
  }, DEFAULT_CHARACTER)
  const p = prepareRound(generateScenario(51, 51 * 919), { regenerate: false })
  const option = p.balls[0].options.find(o => o.label === (mobile ? 'B' : 'C'))!
  const evidence = kickIntroductionEvidence(p.scenario, simulateShot(p.scenario, option.plan))!
  await page.goto('/'); await startLevel(page, 51)
  await page.getByRole('button', { name: 'Choose a stroke', exact: true }).click()
  const panel = page.getByRole('region', { name: 'Kick-shot introduction', exact: true })
  const predictions = panel.getByRole('group', { name: 'Kick-shot prediction' })
  await expect(panel.getByRole('img')).toHaveCount(0)
  if (mobile) await predictions.getByRole('button', { name: 'Ball 1', exact: true }).click()
  await page.getByRole('button', { name: `Choose finish ${option.label}`, exact: true }).click()
  await page.getByRole('button', { name: 'Lock in your shot', exact: true }).click()
  await expect(panel.getByRole('status')).toContainText(mobile ? 'The cue ball must take the cushion first.' : 'Trace the cue ball to its first cushion.', { timeout: 30000 })
  await expect(panel).toContainText(`Selected finish ${option.label}`)
  await expect(panel).toContainText(`Cue-ball rebound R1: ${evidence.first.time.toFixed(2)} s`)
  await expect(panel).toContainText(`ball 1 at ${evidence.contact.time.toFixed(2)} s`)
  const xy = (await panel.getByTestId('required-kick-rebound').getAttribute('transform'))!.slice(10, -1).split(' ').map(Number)
  expect(xy[0]).toBeCloseTo(evidence.first.position.x, 10)
  expect(xy[1]).toBeCloseTo(evidence.first.position.y, 10)
  for (const button of await predictions.getByRole('button').all()) await expect(button).toBeDisabled()
  await expect(page.locator('.perfect-celebration')).toHaveCount(0, { timeout: 10000 })
  await panel.getByRole('img').scrollIntoViewIfNeeded()
  await page.locator('.shot-panel').screenshot({ path: `/tmp/kick-introduction-${mobile ? 'mobile' : 'desktop'}.png` })
  await panel.getByRole('button', { name: 'Try the prediction again' }).click()
  await expect(panel.getByRole('img')).toHaveCount(0)
  await predictions.getByRole('button', { name: 'Cue ball', exact: true }).click()
  await panel.getByRole('button', { name: 'Check prediction' }).click()
  await expect(panel.getByRole('status')).toContainText('Correct: the cue ball rebounds before contacting ball 1.')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'Next level', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Start level 52', exact: true })).toBeVisible()
})
