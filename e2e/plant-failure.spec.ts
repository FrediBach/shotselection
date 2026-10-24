import { expect, test } from '@playwright/test'
import { DEFAULT_CHARACTER } from '../src/engine/characters'
import { prepareRound } from '../src/engine/preparation'
import { generateScenario } from '../src/engine/scenarios'
import { analyzeRound } from '../src/engine/analysis'
import { PLANT_FAILURE_LINKS, PLANT_STAGE_LABELS, plantFailureSummary } from '../src/engine/plant-failure'
import { startLevel } from './helpers'
for (const mobile of [true, false]) test(`diagnose plant trial failures on ${mobile ? 'mobile' : 'desktop'}`, async ({ page }) => {
  test.setTimeout(90000)
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1050 })
  await page.addInitScript(character => {
    localStorage.setItem('shot-selection-help-dismissed', 'true')
    localStorage.setItem('shot-selection-sound-enabled', 'false')
    localStorage.setItem('shot-selection-session', JSON.stringify({ character, scoringVersion: 2, courseVersion: 5, completedLessons: 67, level: 68, score: 0, rounds: 67, perfect: 0, seed: 0 }))
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function(type: string, ...args: unknown[]) { if (type === 'webgl2') return null; return original.call(this, type as '2d', ...args) } as typeof original
  }, DEFAULT_CHARACTER)
  const p = prepareRound(generateScenario(68, 68 * 919), { regenerate: false }), reference = p.balls[0].options[0]
  const selected = mobile ? reference : p.balls[1].options[0]
  const result = analyzeRound(p, { ballId: selected.plan.ballId, optionId: selected.id }, { samples: 64, talents: DEFAULT_CHARACTER.talents })
  const summary = plantFailureSummary(result.candidates.find(s => s.plan.id === reference.id)!)!
  const wrong = PLANT_FAILURE_LINKS.find(key => !summary.limiting.includes(key)) ?? PLANT_FAILURE_LINKS[0]
  await page.goto('/'); await startLevel(page, 68)
  await expect(page.getByRole('button', { name: 'Plant target ball 2', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: mobile ? 'Select plant 1 to 2' : 'Select free ball 3', exact: true }).click()
  await page.getByRole('button', { name: 'Choose a finish', exact: true }).click()
  const panel = page.getByRole('region', { name: 'Plant failure-link comparison', exact: true })
  const predictions = panel.getByRole('group', { name: 'Failure-link prediction' })
  await expect(panel.getByRole('table')).toHaveCount(0)
  if (mobile) await predictions.getByRole('button', { name: PLANT_STAGE_LABELS[wrong], exact: true }).click()
  await page.getByRole('button', { name: `Choose finish ${selected.label}`, exact: true }).click()
  await page.getByRole('button', { name: 'Lock in your shot', exact: true }).click()
  await expect(panel.getByRole('status')).toContainText(summary.limiting.map(key => PLANT_STAGE_LABELS[key]).join(' and '), { timeout: 30000 })
  await expect(panel).toContainText(mobile ? `You chose reference plant finish ${reference.label}.` : 'You chose another stroke')
  for (const button of await predictions.getByRole('button').all()) await expect(button).toBeDisabled()
  let before = 0
  for (const key of [...PLANT_FAILURE_LINKS, 'success', 'unsettled'] as const) {
    await expect(panel.getByTestId(`failure-row-${key}`)).toContainText(`${summary.counts[key]}/${summary.trials}`)
    expect(Number(await panel.getByTestId(`failure-bar-${key}`).getAttribute('width'))).toBeCloseTo(summary.counts[key] / summary.trials * 300, 9)
    expect(Number(await panel.getByTestId(`failure-bar-${key}`).getAttribute('x'))).toBeCloseTo(before / summary.trials * 300, 9)
    before += summary.counts[key]
  }
  expect(before).toBe(64)
  await expect(panel).toContainText('not conditional failure rates')
  await expect(panel).toContainText('no simulations and changes no scores')
  await expect(page.locator('.perfect-celebration')).toHaveCount(0, { timeout: 10000 })
  await panel.getByRole('table').first().scrollIntoViewIfNeeded()
  await page.locator('.shot-panel').screenshot({ path: `/tmp/plant-failure-counts-${mobile ? 'mobile' : 'desktop'}.png` })
  await panel.locator('summary').click()
  for (const candidate of result.candidates) await expect(panel.getByTestId(`failure-choice-${candidate.plan.id}`)).toContainText(`${candidate.trialSuccesses!.filter(Boolean).length}/${candidate.samples}`)
  await panel.getByRole('table').last().scrollIntoViewIfNeeded()
  await page.locator('.shot-panel').screenshot({ path: `/tmp/plant-failure-choices-${mobile ? 'mobile' : 'desktop'}.png` })
  await panel.getByRole('button', { name: 'Try the prediction again' }).click()
  await expect(panel.getByRole('table')).toHaveCount(0)
  await predictions.getByRole('button', { name: PLANT_STAGE_LABELS[summary.limiting[0]], exact: true }).click()
  await panel.getByRole('button', { name: 'Check prediction' }).click()
  await expect(panel.getByRole('status')).toContainText('Your prediction matches a largest sampled loss.')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'Next level', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Start level 69', exact: true })).toBeVisible()
})
