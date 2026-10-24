import { expect, test } from '@playwright/test'
import { DEFAULT_CHARACTER } from '../src/engine/characters'
import { generateScenario } from '../src/engine/scenarios'
import { prepareRound } from '../src/engine/preparation'
import { simulateShot } from '../src/engine/physics'
import { englishRoutingEvidence } from '../src/engine/english-routing'
import { startLevel } from './helpers'

for (const mobile of [true, false]) test(`compare controlled English routes on ${mobile ? 'mobile' : 'desktop'}`, async ({ page }) => {
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1050 })
  await page.addInitScript(character => {
    localStorage.setItem('shot-selection-help-dismissed', 'true')
    localStorage.setItem('shot-selection-sound-enabled', 'false')
    localStorage.setItem('shot-selection-session', JSON.stringify({ character, scoringVersion: 2, courseVersion: 5, completedLessons: 48, level: 49, score: 0, rounds: 48, perfect: 0, seed: 0 }))
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function(type: string, ...args: unknown[]) { if (type === 'webgl2') return null; return original.call(this, type as '2d', ...args) } as typeof original
  }, DEFAULT_CHARACTER)
  const p = prepareRound(generateScenario(49, 49 * 919), { regenerate: false })
  const reference = p.balls[0].options.find(o => o.id === p.englishRouting!.referenceId)!
  const e = englishRoutingEvidence(p.scenario, {plan:reference.plan, simulation:simulateShot(p.scenario,reference.plan)})!
  const selected = mobile ? reference : p.balls[0].options.find(o => o.id !== reference.id)!
  await page.goto('/'); await startLevel(page, 49)
  await page.getByRole('button', { name: 'Select ball 1', exact: true }).click()
  await page.getByRole('button', { name: 'Choose a stroke', exact: true }).click()
  const panel = page.getByRole('region', { name: 'English routing comparison', exact: true })
  const predictions = panel.getByRole('group', { name: 'English routing prediction', exact: true })
  await expect(panel.getByRole('img')).toHaveCount(0)
  if (mobile) await predictions.getByRole('button', { name: 'Same side', exact: true }).click()
  await page.getByRole('button', { name: `Choose stroke ${selected.label}`, exact: true }).click()
  await page.getByRole('button', { name: 'Lock in your shot', exact: true }).click()
  await expect(panel.getByRole('status')).toContainText(mobile ? 'The routes pass on opposite sides' : 'Compare the two routes after the cushion', { timeout: 30000 })
  await expect(panel).toContainText(mobile ? 'is the English reference' : 'is another offered stroke')
  for (const button of await predictions.getByRole('button').all()) await expect(button).toBeDisabled()
  await expect(panel.getByRole('img')).toHaveCount(3)
  await expect(panel).toContainText(`${(e.withEnglish.clearance * 1000).toFixed(1)} mm`)
  await expect(panel).toContainText(`${(e.withoutEnglish.clearance * 1000).toFixed(1)} mm`)
  await expect(panel).toContainText(`${e.outgoingDifference.toFixed(1)}°`)
  await expect(panel).toContainText('same 22.0 cm-radius zone')
  await expect(panel).toContainText('separate diagnostic, not one of the three offered strokes')
  await expect(page.locator('.perfect-celebration')).toHaveCount(0, { timeout: 10000 })
  for (const title of [`Stroke ${reference.label} · With English`, 'Controlled comparison · No English']) {
    const diagram = panel.getByRole('img', { name: `${title}: route around ball 3`, exact: true })
    expect(await diagram.locator('text').allTextContents()).toEqual(['', '1', '2', '3', '4', '5'])
    await diagram.scrollIntoViewIfNeeded()
    await page.locator('.shot-panel').screenshot({ path: `/tmp/english-${title.startsWith('Stroke') ? 'reference' : 'control'}-${mobile ? 'mobile' : 'desktop'}.png` })
  }
  await panel.getByRole('img', { name: 'Enlarged English and no-English paths around ball 3', exact: true }).scrollIntoViewIfNeeded()
  await page.locator('.shot-panel').screenshot({ path: `/tmp/english-gap-${mobile ? 'mobile' : 'desktop'}.png` })
  await panel.getByRole('button', { name: 'Try the prediction again', exact: true }).click()
  await expect(panel.getByRole('img')).toHaveCount(0)
  await predictions.getByRole('button', { name: 'Opposite sides', exact: true }).click()
  await panel.getByRole('button', { name: 'Check prediction', exact: true }).click()
  await expect(panel.getByRole('status')).toContainText('Correct: English changes which side')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'Next level', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Start level 50', exact: true })).toBeVisible()
  await expect(panel).toHaveCount(0)
})
