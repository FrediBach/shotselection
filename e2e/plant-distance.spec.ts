import { expect, test } from '@playwright/test'
import { DEFAULT_CHARACTER } from '../src/engine/characters'
import { prepareRound } from '../src/engine/preparation'
import { generateScenario } from '../src/engine/scenarios'
import { plantDistanceEvidence } from '../src/engine/plant-distance'
import { startLevel } from './helpers'
for (const mobile of [true, false]) test(`compare target travel distance on ${mobile ? 'mobile' : 'desktop'}`, async ({ page }) => {
  test.setTimeout(90000)
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1050 })
  await page.addInitScript(character => {
    localStorage.setItem('shot-selection-help-dismissed', 'true')
    localStorage.setItem('shot-selection-sound-enabled', 'false')
    localStorage.setItem('shot-selection-session', JSON.stringify({ character, scoringVersion: 2, courseVersion: 5, completedLessons: 64, level: 65, score: 0, rounds: 64, perfect: 0, seed: 0 }))
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function(type: string, ...args: unknown[]) { if (type === 'webgl2') return null; return original.call(this, type as '2d', ...args) } as typeof original
  }, DEFAULT_CHARACTER)
  const p = prepareRound(generateScenario(65, 65 * 919), { regenerate: false }), x = p.plantDistance!
  const reference = p.balls.find(b => b.ballId === 1)!.options.find(o => o.id === x.referenceId)!
  const selected = mobile ? reference : p.balls.find(b => b.ballId === 3)!.options[0]
  const e = plantDistanceEvidence(p.scenario, reference.plan, x)!
  await page.goto('/'); await startLevel(page, 65)
  await expect(page.getByRole('button', { name: 'Plant target ball 2', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Select free ball 3', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: mobile ? 'Select plant 1 to 2' : 'Select free ball 3', exact: true }).click()
  await page.getByRole('button', { name: 'Choose a finish', exact: true }).click()
  const panel = page.getByRole('region', { name: 'Plant target-distance comparison', exact: true })
  const predictions = panel.getByRole('group', { name: 'Target-distance prediction' })
  await expect(panel.getByRole('img')).toHaveCount(0)
  if (mobile) await predictions.getByRole('button', { name: 'Short run', exact: true }).click()
  await page.getByRole('button', { name: `Choose finish ${selected.label}`, exact: true }).click()
  await page.getByRole('button', { name: 'Lock in your shot', exact: true }).click()
  await expect(panel.getByRole('status')).toContainText('The longer run produces more lateral deviation.', { timeout: 30000 })
  await expect(panel).toContainText(mobile ? `You chose reference plant finish ${reference.label}.` : 'You chose another stroke')
  for (const button of await predictions.getByRole('button').all()) await expect(button).toBeDisabled()
  const checkPath = async (id: string, expected: { x: number; y: number }[]) => {
    const path = (await panel.getByTestId(id).getAttribute('points'))!.split(' ').map(pair => pair.split(',').map(Number))
    expect(path.length).toBe(expected.length)
    path.forEach(([a, b], j) => { expect(a).toBeCloseTo(expected[j].x, 9); expect(b).toBeCloseTo(expected[j].y, 9) })
  }
  await expect(panel).toContainText(`${e.angle.toFixed(2)}° in each`)
  for (const distance of [e.shortDrift, e.longDrift]) await expect(panel).toContainText(`${(distance * 1000).toFixed(1)} mm`)
  for (const distance of [e.shortNominal.travel, e.longNominal.travel]) await expect(panel).toContainText(`${(distance * 100).toFixed(1)} cm`)
  for (const short of [true, false]) {
    const id = short ? 'short' : 'long', a = short ? e.shortNominal : e.longNominal, b = short ? e.shortChanged : e.longChanged
    const target = (short ? e.short : p.scenario).balls.find(ball => ball.id === 2)!.position
    await checkPath(`${id}-nominal-path`, (short ? x.shortNominal : x.longNominal).objectPath)
    await checkPath(`${id}-changed-path`, (short ? x.shortChanged : x.longChanged).objectPath)
    await checkPath(`${id}-nominal-ray`, [target, a.hit]); await checkPath(`${id}-changed-ray`, [target, b.hit])
    await checkPath(`${id}-deviation`, [a.hit, b.hit])
  }
  await expect(page.locator('.perfect-celebration')).toHaveCount(0, { timeout: 10000 })
  for (const mode of ['Full routes', 'Pocket detail']) {
    await panel.getByRole('group', { name: 'Inspect target travel' }).getByRole('button', { name: mode, exact: true }).click()
    for (const run of ['Short', 'Long']) {
      const svg = panel.getByRole('img', { name: `${run} run: original and changed target paths`, exact: true })
      await svg.scrollIntoViewIfNeeded()
      if (mode === 'Full routes') await expect(svg).toHaveAttribute('viewBox', '-.08 -.08 2.70 1.43')
      await page.locator('.shot-panel').screenshot({ path: `/tmp/plant-distance-${mode === 'Full routes' ? 'table' : 'detail'}-${run.toLowerCase()}-${mobile ? 'mobile' : 'desktop'}.png` })
    }
  }
  await panel.getByRole('button', { name: 'Try the prediction again' }).click()
  await expect(panel.getByRole('img')).toHaveCount(0)
  await predictions.getByRole('button', { name: 'Long run', exact: true }).click()
  await panel.getByRole('button', { name: 'Check prediction' }).click()
  await expect(panel.getByRole('status')).toContainText('Correct: the longer run produces more lateral deviation.')
  await expect(panel.getByRole('group', { name: 'Inspect target travel' }).getByRole('button', { name: 'Full routes', exact: true })).toHaveAttribute('aria-pressed', 'true')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'Next level', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Start level 66', exact: true })).toBeVisible()
})
