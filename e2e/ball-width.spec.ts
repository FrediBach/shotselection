import { expect, test } from '@playwright/test'
import { DEFAULT_CHARACTER } from '../src/engine/characters'
import { generateScenario } from '../src/engine/scenarios'
import { prepareRound } from '../src/engine/preparation'
import { ballWidthEvidence } from '../src/engine/ball-width'
import { startLevel } from './helpers'

for (const mobile of [true, false]) test(`full ball width on ${mobile ? 'mobile' : 'desktop'}`, async ({ page }) => {
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1050 })
  await page.addInitScript(character => {
    localStorage.setItem('shot-selection-help-dismissed', 'true')
    localStorage.setItem('shot-selection-sound-enabled', 'false')
    localStorage.setItem('shot-selection-session', JSON.stringify({ character, scoringVersion: 2, courseVersion: 5, completedLessons: 40, level: 41, score: 0, rounds: 40, perfect: 0, seed: 0 }))
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function(type: string, ...args: unknown[]) { if (type === 'webgl2') return null; return original.call(this, type as '2d', ...args) } as typeof original
  }, DEFAULT_CHARACTER)
  const p = prepareRound(generateScenario(41, 41 * 919), { regenerate: false }), e = ballWidthEvidence(p.scenario)!
  const ball = p.balls.find(b => mobile ? b.ballId === e.ballId : b.ballId !== e.ballId)!, selected = ball.options[0]
  await page.goto('/'); await startLevel(page, 41)
  const panel = page.getByRole('region', { name: 'Full-ball-width comparison', exact: true })
  const predictions = panel.getByRole('group', { name: 'Wide-corridor prediction', exact: true })
  await expect(panel.getByRole('img', { name: /center lines only/ })).toHaveCount(2)
  if (mobile) await predictions.getByRole('button', { name: `${e.narrow.pocket.name} pocket`, exact: true }).click()
  await page.getByRole('button', { name: `Select ball ${ball.ballId}`, exact: true }).click()
  await page.getByRole('button', { name: 'Choose a finish', exact: true }).click()
  await page.getByRole('button', { name: `Choose finish ${selected.label}`, exact: true }).click()
  await page.getByRole('button', { name: 'Lock in your shot', exact: true }).click()
  await expect(panel.getByRole('status')).toContainText(mobile ? 'The center line fits, but the whole ball does not' : 'Compare the full swept widths', { timeout: 30000 })
  await expect(panel.getByRole('img', { name: /full swept width/ })).toHaveCount(2)
  await expect(panel).toContainText('Ball 5 overlaps the swept object-to-pocket line')
  await expect(panel).toContainText(`${((e.narrow.minimum - .05715) * 1000).toFixed(1)} mm`)
  for (const button of await predictions.getByRole('button').all()) await expect(button).toBeDisabled()
  await expect(page.locator('.perfect-celebration')).toHaveCount(0, { timeout: 10000 })
  await panel.getByRole('img', { name: 'Narrow corridor: enlarged physical overlap', exact: true }).scrollIntoViewIfNeeded()
  await page.locator('.shot-panel').screenshot({ path: `/tmp/ball-width-overlap-${mobile ? 'mobile' : 'desktop'}.png` })
  await panel.getByRole('button', { name: 'Inspect wide-route proof', exact: true }).click()
  await expect(panel.getByRole('img')).toHaveCount(4)
  await expect(panel).toContainText('not a replay of your selected stroke')
  await panel.getByRole('img', { name: 'Wide corridor: simulated legal pot', exact: true }).scrollIntoViewIfNeeded()
  await page.locator('.shot-panel').screenshot({ path: `/tmp/ball-width-proof-${mobile ? 'mobile' : 'desktop'}.png` })
  await panel.getByRole('button', { name: 'Try the prediction again', exact: true }).click()
  await expect(panel.getByRole('img', { name: /center lines only/ })).toHaveCount(2)
  await predictions.getByRole('button', { name: `${e.wide.pocket.name} pocket`, exact: true }).click()
  await panel.getByRole('button', { name: 'Check prediction', exact: true }).click()
  await expect(panel.getByRole('status')).toContainText('Your prediction leaves room for the whole ball')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'Next level', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Start level 42', exact: true })).toBeVisible()
  await expect(panel).toHaveCount(0)
})
