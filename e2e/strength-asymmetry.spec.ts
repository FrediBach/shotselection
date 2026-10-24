import { expect, test } from '@playwright/test'
import { DEFAULT_CHARACTER } from '../src/engine/characters'
import { prepareRound } from '../src/engine/preparation'
import { generateScenario } from '../src/engine/scenarios'
import { protectedDirection } from '../src/engine/strength-asymmetry'

import { startLevel } from './helpers'
for (const mobile of [true, false]) test(`inspect asymmetric strength boundaries on ${mobile ? 'mobile' : 'desktop'}`, async ({ page }) => {
  test.setTimeout(90000)
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1050 })
  await page.addInitScript(character => {
    localStorage.setItem('shot-selection-help-dismissed', 'true')
    localStorage.setItem('shot-selection-sound-enabled', 'false')
    localStorage.setItem('shot-selection-session', JSON.stringify({ character, scoringVersion: 2, courseVersion: 5, completedLessons: 72, level: 73, score: 0, rounds: 72, perfect: 0, seed: 0 }))
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function(type: string, ...args: unknown[]) { if (type === 'webgl2') return null; return original.call(this, type as '2d', ...args) } as typeof original
  }, DEFAULT_CHARACTER)
  const p = prepareRound(generateScenario(73, 73 * 919), { regenerate: false })
  const selected = p.balls[0].options[mobile ? 0 : 2]
  await page.goto('/'); await startLevel(page, 73)
  await page.getByRole('button', { name: 'Select ball 1', exact: true }).click()
  await page.getByRole('button', { name: 'Choose a stroke', exact: true }).click()
  const panel = page.getByRole('region', { name: 'Asymmetric strength comparison', exact: true })
  const evidence = p.strengthAsymmetry!, names = ['Slower variant', 'Faster variant']
  await expect(panel.getByRole('table')).toHaveCount(0)
  await expect(panel.getByRole('img')).toHaveCount(0)
  if (mobile) await panel.getByRole('button', { name: 'Too hard', exact: true }).click()
  await page.getByRole('button', { name: `Choose stroke ${selected.label}`, exact: true }).click()
  await page.getByRole('button', { name: 'Lock in your shot', exact: true }).click()
  await expect(panel.getByRole('status')).toContainText('too-soft errors', { timeout: 30000 })
  await expect(panel).toContainText(mobile ? 'You selected reference stroke A.' : 'You selected another stroke')
  await expect(page.locator('.perfect-celebration')).toHaveCount(0, { timeout: 10000 })
  for (const [index, variant] of evidence.variants.entries()) {
    await panel.getByRole('button', { name: names[index], exact: true }).click()
    await expect(panel.getByRole('status')).toContainText(`too-${protectedDirection(variant.sides[0].value, variant.sides[1].value)} errors`)
    for (const [side, boundary] of variant.sides.entries()) {
      const signed = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(4)}%`
      await expect(panel.getByTestId(`strength-margin-${side}`)).toContainText(signed(boundary.passing.offset))
      await expect(panel.getByTestId(`strength-margin-${side}`)).toContainText(signed(boundary.failing!.offset))
      await panel.getByRole('button', { name: side ? 'Too hard boundary' : 'Too soft boundary', exact: true }).click()
      for (const key of ['legalPot', 'positioned', 'nextShotAvailable', 'success'] as const) {
        const cells = panel.getByTestId(`strength-condition-${key}`).getByRole('cell')
        await expect(cells.nth(0)).toHaveText(boundary.passing.outcome[key] ? 'Yes' : 'No')
        await expect(cells.nth(1)).toHaveText(boundary.failing!.outcome[key] ? 'Yes' : 'No')
      }
      for (const passing of [true, false]) {
        await panel.getByRole('button', { name: passing ? 'Last passing' : 'First failing', exact: true }).click()
        const probe = passing ? boundary.passing : boundary.failing!
        expect(await panel.getByRole('img').locator('polyline').first().getAttribute('points')).toBe(probe.simulation.cuePath.map(p => `${p.x},${p.y}`).join(' '))
        await expect(panel.locator('figcaption')).toContainText(signed(probe.offset))
      }
    }
  }
  for (const button of await panel.getByRole('group', { name: 'Narrower margin prediction' }).getByRole('button').all()) await expect(button).toBeDisabled()
  await panel.getByRole('table').first().scrollIntoViewIfNeeded()
  await page.locator('.shot-panel').screenshot({ path: `/tmp/strength-margins-${mobile ? 'mobile' : 'desktop'}.png` })
  await panel.getByRole('img').scrollIntoViewIfNeeded()
  await page.locator('.shot-panel').screenshot({ path: `/tmp/strength-boundary-${mobile ? 'mobile' : 'desktop'}.png` })
  await panel.getByRole('table').last().scrollIntoViewIfNeeded()
  await page.locator('.shot-panel').screenshot({ path: `/tmp/strength-outcomes-${mobile ? 'mobile' : 'desktop'}.png` })
  await panel.getByRole('button', { name: 'Try the predictions again' }).click()
  await expect(panel.getByRole('table')).toHaveCount(0)
  await expect(panel.getByRole('button', { name: 'Slower variant', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await panel.getByRole('button', { name: 'Too soft', exact: true }).click()
  await panel.getByRole('button', { name: 'Check predictions' }).click()
  await expect(panel.getByRole('status')).toContainText('Your prediction matches.')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'Next level', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Start level 74', exact: true })).toBeVisible()
})
