import { expect, test } from '@playwright/test'
import { DEFAULT_CHARACTER } from '../src/engine/characters'
import { prepareRound } from '../src/engine/preparation'
import { generateScenario } from '../src/engine/scenarios'
import { startLevel } from './helpers'
for (const mobile of [true, false]) test(`adapt the actual landing on ${mobile ? 'mobile' : 'desktop'}`, async ({ page }) => {
  test.setTimeout(90000)
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1050 })
  await page.addInitScript(character => {
    localStorage.setItem('shot-selection-help-dismissed', 'true')
    localStorage.setItem('shot-selection-sound-enabled', 'false')
    localStorage.setItem('shot-selection-session', JSON.stringify({ character, scoringVersion: 2, courseVersion: 5, completedLessons: 79, level: 80, score: 0, rounds: 79, perfect: 0, seed: 0 }))
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function(type: string, ...args: unknown[]) { if (type === 'webgl2') return null; return original.call(this, type as '2d', ...args) } as typeof original
  }, DEFAULT_CHARACTER)
  const p = prepareRound(generateScenario(80, 80 * 919)), data = p.landingRecovery!
  await page.goto('/'); await startLevel(page, 80)
  await page.getByRole('button', { name: 'Select ball 1', exact: true }).click()
  await page.getByRole('button', { name: 'Choose a stroke', exact: true }).click()
  const panel = page.getByRole('region', { name: 'Landing recovery comparison', exact: true })
  await expect(panel.getByRole('status')).toHaveCount(0)
  if (mobile) for (const i of [0, 1]) await panel.getByRole('group', { name: `Response for landing ${i+1}`, exact: true }).getByRole('button', { name: `Response ${2-i}`, exact: true }).click()
  await page.getByRole('button', { name: 'Choose stroke A', exact: true }).click()
  await page.getByRole('button', { name: 'Lock in your shot', exact: true }).click()
  await expect(panel.getByRole('status')).toContainText('Copying the other landing’s controls fails', { timeout: 30000 })
  await expect(page.locator('.perfect-celebration')).toHaveCount(0, { timeout: 10000 })
  for (const i of [0, 1]) {
    for (const b of await panel.getByRole('group', { name: `Response for landing ${i+1}`, exact: true }).getByRole('button').all()) await expect(b).toBeDisabled()
    await panel.getByRole('button', { name: `Landing ${i+1}`, exact: true }).click()
    await expect(panel).toContainText(`next cut ${data.leaves[i].cut.toFixed(1)}°`)
    const zone = panel.getByRole('img').locator('circle[stroke-dasharray]')
    expect(Number(await zone.getAttribute('r'))).toBe(.12)
    expect(Number(await zone.getAttribute('cx'))).toBeCloseTo(p.scenario.objective!.target!.x, 9)
    for (const [label, sim] of [['Opening path', data.leaves[i].first], ['Adapted response', data.leaves[i].second], ['Copied response', data.copied[i]]] as const) {
      await panel.getByRole('button', { name: label, exact: true }).click()
      for (const [index, path] of [sim.cuePath, sim.objectPath].entries()) {
        const actual = (await panel.getByRole('img').locator('polyline').nth(index).getAttribute('points'))!.split(' ').map(pair => pair.split(',').map(Number))
        expect(actual).toHaveLength(path.length)
        for (const [j, point] of path.entries()) { expect(actual[j][0]).toBeCloseTo(point.x, 9); expect(actual[j][1]).toBeCloseTo(point.y, 9) }
      }
    }
  }
  await panel.getByRole('img').scrollIntoViewIfNeeded()
  await page.locator('.shot-panel').screenshot({ path: `/tmp/landing-recovery-${mobile ? 'mobile' : 'desktop'}.png` })
  await panel.getByRole('button', { name: 'Try the responses again', exact: true }).click()
  await expect(panel.getByRole('status')).toHaveCount(0)
  await expect(panel.getByRole('button', { name: 'Adapted response', exact: true })).toHaveCount(0)
  for (const i of [0, 1]) {
    const group = panel.getByRole('group', { name: `Response for landing ${i+1}`, exact: true })
    for (const b of await group.getByRole('button').all()) await expect(b).toHaveAttribute('aria-pressed', 'false')
    await group.getByRole('button', { name: `Response ${i+1}`, exact: true }).click()
  }
  await panel.getByRole('button', { name: 'Check responses', exact: true }).click()
  await expect(panel.getByRole('status')).toContainText('Both choices match.')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'Next level', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Start level 81', exact: true })).toBeVisible()
})
