import { expect, test } from '@playwright/test'
import { DEFAULT_CHARACTER } from '../src/engine/characters'
import { prepareRound } from '../src/engine/preparation'
import { generateScenario } from '../src/engine/scenarios'
import { plantMarginEvidence } from '../src/engine/plant-margin'
import { startLevel } from './helpers'
for (const mobile of [true, false]) test(`compare plant aiming margin on ${mobile ? 'mobile' : 'desktop'}`, async ({ page }) => {
  test.setTimeout(90000)
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1050 })
  await page.addInitScript(character => {
    localStorage.setItem('shot-selection-help-dismissed', 'true')
    localStorage.setItem('shot-selection-sound-enabled', 'false')
    localStorage.setItem('shot-selection-session', JSON.stringify({ character, scoringVersion: 2, courseVersion: 5, completedLessons: 62, level: 63, score: 0, rounds: 62, perfect: 0, seed: 0 }))
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function(type: string, ...args: unknown[]) { if (type === 'webgl2') return null; return original.call(this, type as '2d', ...args) } as typeof original
  }, DEFAULT_CHARACTER)
  const p = prepareRound(generateScenario(63, 63 * 919), { regenerate: false }), x = p.plantMargin!
  const reference = p.balls.find(b => b.ballId === 1)!.options.find(o => o.id === x.referenceId)!
  const selected = mobile ? reference : p.balls.find(b => b.ballId === 3)!.options[0]
  const e = plantMarginEvidence(p.scenario, reference.plan, x)!
  await page.goto('/'); await startLevel(page, 63)
  await expect(page.getByRole('button', { name: 'Plant target ball 2', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: mobile ? 'Select plant 1 to 2' : 'Select free ball 3', exact: true }).click()
  await page.getByRole('button', { name: 'Choose a finish', exact: true }).click()
  const panel = page.getByRole('region', { name: 'Plant aiming-margin comparison', exact: true })
  const predictions = panel.getByRole('group', { name: 'Margin prediction' })
  await expect(panel.getByRole('img')).toHaveCount(0)
  if (mobile) await predictions.getByRole('button', { name: 'Offset pair', exact: true }).click()
  await page.getByRole('button', { name: `Choose finish ${selected.label}`, exact: true }).click()
  await page.getByRole('button', { name: 'Lock in your shot', exact: true }).click()
  await expect(panel.getByRole('status')).toContainText('The centered reference has more aiming room.', { timeout: 30000 })
  await expect(panel).toContainText(mobile ? `You chose reference plant finish ${reference.label}.` : 'You chose another stroke')
  await expect(panel).toContainText(`±${e.centeredMargin.toFixed(3)}°`)
  await expect(panel).toContainText(`±${e.offsetMargin.toFixed(3)}°`)
  await expect(panel).toContainText('Cue-ball finish and scratch are excluded')
  for (const key of ['centeredPot', 'offsetPot'] as const) for (const [i, sample] of x.samples.entries()) {
    await expect(panel.getByTestId(`margin-${key}-${i}`)).toHaveAttribute('aria-label', `${sample.degrees.toFixed(3)} degrees: ${sample[key] ? 'pot' : 'miss'}`)
  }
  for (const button of await predictions.getByRole('button').all()) await expect(button).toBeDisabled()
  const checkPath = async (id: string, expected: { x: number; y: number }[]) => {
    const path = (await panel.getByTestId(id).getAttribute('points'))!.split(' ').map(pair => pair.split(',').map(Number))
    expect(path.length).toBe(expected.length)
    path.forEach(([a, b], j) => { expect(a).toBeCloseTo(expected[j].x, 9); expect(b).toBeCloseTo(expected[j].y, 9) })
  }
  await checkPath('centered-actual', x.centeredNominal.objectPath)
  await checkPath('offset-actual', x.offsetNominal.objectPath)
  await panel.getByRole('button', { name: 'Same aim change', exact: true }).click()
  await expect(panel).toContainText(`${x.witnessDegrees > 0 ? '+' : ''}${x.witnessDegrees.toFixed(3)}° to both`)
  await checkPath('centered-actual', x.centeredWitness.objectPath)
  await checkPath('offset-actual', x.offsetWitness.objectPath)
  await expect(page.locator('.perfect-celebration')).toHaveCount(0, { timeout: 10000 })
  await panel.getByRole('img', { name: 'Sampled target pots: centered reference and offset pair', exact: true }).scrollIntoViewIfNeeded()
  await page.locator('.shot-panel').screenshot({ path: `/tmp/plant-margin-samples-${mobile ? 'mobile' : 'desktop'}.png` })
  await panel.getByRole('img', { name: 'offset target-ball path', exact: true }).scrollIntoViewIfNeeded()
  await page.locator('.shot-panel').screenshot({ path: `/tmp/plant-margin-${mobile ? 'mobile' : 'desktop'}.png` })
  await panel.getByRole('button', { name: 'Try the prediction again' }).click()
  await expect(panel.getByRole('img')).toHaveCount(0)
  await predictions.getByRole('button', { name: 'Centered reference', exact: true }).click()
  await panel.getByRole('button', { name: 'Check prediction' }).click()
  await expect(panel.getByRole('status')).toContainText('Correct: the centered reference has more aiming room.')
  await checkPath('offset-actual', x.offsetNominal.objectPath)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'Next level', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Start level 64', exact: true })).toBeVisible()
})
