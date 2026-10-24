import { expect, test } from '@playwright/test'
import { DEFAULT_CHARACTER } from '../src/engine/characters'
import { generateScenario } from '../src/engine/scenarios'
import { prepareRound } from '../src/engine/preparation'
import { comparePlayerProfiles } from '../src/engine/player-profile'
import { startLevel } from './helpers'
for (const mobile of [true, false]) test(`match player error profiles on ${mobile ? 'mobile' : 'desktop'}`, async ({ page }) => {
  test.setTimeout(120000)
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1050 })
  await page.addInitScript(character => {
    localStorage.setItem('shot-selection-help-dismissed', 'true')
    localStorage.setItem('shot-selection-sound-enabled', 'false')
    localStorage.setItem('shot-selection-session', JSON.stringify({ character, scoringVersion: 2, courseVersion: 5, completedLessons: 77, level: 78, score: 0, rounds: 77, perfect: 0, seed: 0 }))
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function(type: string, ...args: unknown[]) { if (type === 'webgl2') return null; return original.call(this, type as '2d', ...args) } as typeof original
  }, DEFAULT_CHARACTER)
  const p = prepareRound(generateScenario(78, 78 * 919), { regenerate: false })
  const data = comparePlayerProfiles(p.scenario, p.balls[0].options.map(o => o.plan))
  expect(data.switched).toBe(true)
  await page.goto('/'); await startLevel(page, 78)
  await page.getByRole('button', { name: 'Select ball 1', exact: true }).click()
  await page.getByRole('button', { name: 'Choose a stroke', exact: true }).click()
  const panel = page.getByRole('region', { name: 'Player error profile comparison', exact: true })
  await expect(panel.getByRole('table')).toHaveCount(0)
  if (mobile) for (const name of ['Precise pace', 'Precise aim']) await panel.getByRole('group', { name: `${name} prediction`, exact: true }).getByRole('button', { name: 'Stroke C', exact: true }).click()
  await page.getByRole('button', { name: 'Choose stroke B', exact: true }).click()
  await page.getByRole('button', { name: 'Lock in your shot', exact: true }).click()
  await expect(panel.getByRole('status')).toContainText('The preferred stroke changes', { timeout: 60000 })
  await expect(page.locator('.perfect-celebration')).toHaveCount(0, { timeout: 10000 })
  for (const [row, profile] of data.profiles.entries()) {
    for (const [column, shot] of profile.shots.entries()) await expect(panel.getByTestId(`profile-row-${row}`).getByRole('cell').nth(column)).toHaveText(`${shot.count}/128`)
    for (const button of await panel.getByRole('group', { name: `${profile.name} prediction`, exact: true }).getByRole('button').all()) await expect(button).toBeDisabled()
  }
  for (const [column, s] of data.sensitivity.entries()) for (const [row, count] of [s.aimCount, s.speedCount].entries()) await expect(panel.getByTestId(`profile-sensitivity-${row}`).getByRole('cell').nth(column)).toHaveText(`${count}/128`)
  await panel.getByRole('table').first().scrollIntoViewIfNeeded()
  await page.locator('.shot-panel').screenshot({ path: `/tmp/profile-table-${mobile ? 'mobile' : 'desktop'}.png` })
  const diagram = panel.getByRole('img', { name: 'Fixed stroke for both player profiles' })
  for (const o of p.balls[0].options) {
    await panel.getByRole('button', { name: `Inspect stroke ${o.label}`, exact: true }).click()
    const end = diagram.locator('circle[fill="none"]')
    expect(Number(await end.getAttribute('cx'))).toBeCloseTo(o.plan.target.x, 9)
    expect(Number(await end.getAttribute('cy'))).toBeCloseTo(o.plan.target.y, 9)
  }
  await panel.getByRole('button', { name: 'Try the predictions again', exact: true }).click()
  await expect(panel.getByRole('table')).toHaveCount(0); await expect(panel.getByRole('img')).toHaveCount(0)
  for (const [index, name] of ['Precise pace', 'Precise aim'].entries()) await panel.getByRole('group', { name: `${name} prediction`, exact: true }).getByRole('button', { name: `Stroke ${index ? 'B' : 'A'}`, exact: true }).click()
  await panel.getByRole('button', { name: 'Check predictions', exact: true }).click()
  await expect(panel.getByRole('status')).toContainText('Your prediction matches.')
  await expect(panel.getByRole('button', { name: 'Inspect stroke A', exact: true })).toHaveAttribute('aria-pressed', 'true')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('shot-selection-session')!).character)).toEqual(DEFAULT_CHARACTER)
  await page.getByRole('button', { name: 'Next level', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Start level 79', exact: true })).toBeVisible()
})
