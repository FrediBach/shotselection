import { expect, test } from '@playwright/test'
import { DEFAULT_CHARACTER } from '../src/engine/characters'
import { prepareRound } from '../src/engine/preparation'
import { generateScenario } from '../src/engine/scenarios'
import { analyzeRound } from '../src/engine/analysis'
import { ASSIGNMENT_CONDITIONS, assignmentFailureSummary } from '../src/engine/assignment-failure'
import { startLevel } from './helpers'
for (const mobile of [true, false]) test(`diagnose overlapping assignment failures on ${mobile ? 'mobile' : 'desktop'}`, async ({ page }) => {
  test.setTimeout(90000)
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1050 })
  await page.addInitScript(character => {
    localStorage.setItem('shot-selection-help-dismissed', 'true')
    localStorage.setItem('shot-selection-sound-enabled', 'false')
    localStorage.setItem('shot-selection-session', JSON.stringify({ character, scoringVersion: 2, courseVersion: 5, completedLessons: 70, level: 71, score: 0, rounds: 70, perfect: 0, seed: 0 }))
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function(type: string, ...args: unknown[]) { if (type === 'webgl2') return null; return original.call(this, type as '2d', ...args) } as typeof original
  }, DEFAULT_CHARACTER)
  const p = prepareRound(generateScenario(71, 71 * 919), { regenerate: false })
  const selected = p.balls[0].options[mobile ? 2 : 1]
  const result = analyzeRound(p, { ballId: selected.plan.ballId, optionId: selected.id }, { samples: 64, talents: DEFAULT_CHARACTER.talents })
  await page.goto('/'); await startLevel(page, 71)
  await page.getByRole('button', { name: 'Select ball 1', exact: true }).click()
  await page.getByRole('button', { name: 'Choose a stroke', exact: true }).click()
  await expect(page.locator('.finish-assurance')).toContainText('diagnostic attempts')
  await expect(page.locator('.finish-assurance')).not.toContainText('All three can pot')
  const panel = page.getByRole('region', { name: 'Assignment failure comparison', exact: true })
  await expect(panel.getByRole('table')).toHaveCount(0)
  if (mobile) await panel.getByRole('button', { name: 'Legal pot', exact: true }).click()
  await page.getByRole('button', { name: `Choose stroke ${selected.label}`, exact: true }).click()
  await page.getByRole('button', { name: 'Lock in your shot', exact: true }).click()
  await expect(panel.getByRole('status')).toContainText('Landing zone', { timeout: 30000 })
  await expect(page.locator('.perfect-celebration')).toHaveCount(0, { timeout: 10000 })
  for (const option of p.balls[0].options) {
    const shot = result.candidates.find(c => c.plan.id === option.id)!, summary = assignmentFailureSummary(shot)!
    await panel.getByRole('button', { name: `Inspect ${option.label}`, exact: true }).click()
    await expect(panel.getByRole('status')).toContainText(summary.limiting.map(i => ASSIGNMENT_CONDITIONS[i]).join(' and '))
    for (let i = 0; i < 3; i++) await expect(panel.getByTestId(`assignment-failure-${i}`)).toContainText(`${summary.failures[i]}/64`)
    await expect(panel.getByTestId('assignment-overlap')).toContainText(`gives ${summary.sum}, but only ${summary.failedTrials}`)
    await panel.locator('summary').click()
    for (let mask = 0; mask < 8; mask++) {
      const row = panel.getByTestId(`assignment-combination-${mask}`)
      await expect(row).toContainText(`${summary.combinations[mask]}/64`)
      const label = mask ? ASSIGNMENT_CONDITIONS.filter((_, i) => mask & (1 << i)).join(' + ') : 'None — complete success'
      await expect(row.getByRole('rowheader')).toHaveText(label)
    }
    if (option.label === 'C') {
      await panel.getByRole('table').last().scrollIntoViewIfNeeded()
      await page.locator('.shot-panel').screenshot({ path: `/tmp/assignment-overlap-${mobile ? 'mobile' : 'desktop'}.png` })
    }
    await panel.locator('summary').click()
  }
  for (const button of await panel.getByRole('group', { name: 'Assignment prediction' }).getByRole('button').all()) await expect(button).toBeDisabled()
  await panel.getByRole('table').first().scrollIntoViewIfNeeded()
  await page.locator('.shot-panel').screenshot({ path: `/tmp/assignment-counts-${mobile ? 'mobile' : 'desktop'}.png` })
  await panel.getByRole('button', { name: 'Try the predictions again' }).click()
  await expect(panel.getByRole('table')).toHaveCount(0)
  await expect(panel.getByRole('button', { name: 'Inspect A', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await panel.getByRole('button', { name: 'Landing zone', exact: true }).click()
  await panel.getByRole('button', { name: 'Check predictions' }).click()
  await expect(panel.getByRole('status')).toContainText('Your prediction matches.')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'Next level', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Start level 72', exact: true })).toBeVisible()
})
