import { expect, test } from '@playwright/test'
import { DEFAULT_CHARACTER } from '../src/engine/characters'
import { prepareRound } from '../src/engine/preparation'
import { generateScenario } from '../src/engine/scenarios'
import { plantIntroductionEvidence } from '../src/engine/plant-introduction'
import { normalize } from '../src/engine/math'
import { startLevel } from './helpers'
for (const mobile of [true, false]) test(`trace introductory plant contacts on ${mobile ? 'mobile' : 'desktop'}`, async ({ page }) => {
  test.setTimeout(90000)
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1050 })
  await page.addInitScript(character => {
    localStorage.setItem('shot-selection-help-dismissed', 'true')
    localStorage.setItem('shot-selection-sound-enabled', 'false')
    localStorage.setItem('shot-selection-session', JSON.stringify({ character, scoringVersion: 2, courseVersion: 5, completedLessons: 60, level: 61, score: 0, rounds: 60, perfect: 0, seed: 0 }))
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function(type: string, ...args: unknown[]) { if (type === 'webgl2') return null; return original.call(this, type as '2d', ...args) } as typeof original
  }, DEFAULT_CHARACTER)
  const p = prepareRound(generateScenario(61, 61 * 919), { regenerate: false }), x = p.plantIntroduction!
  const reference = p.balls.find(b => b.ballId === 1)!.options.find(o => o.id === x.referenceId)!
  const selected = mobile ? reference : p.balls.find(b => b.ballId === 3)!.options[0]
  const e = plantIntroductionEvidence(p.scenario, reference.plan, x.simulation)!
  await page.goto('/'); await startLevel(page, 61)
  await expect(page.getByRole('button', { name: 'Plant target ball 2', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Select free ball 3', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: mobile ? 'Select plant 1 to 2' : 'Select free ball 3', exact: true }).click()
  await page.getByRole('button', { name: 'Choose a finish', exact: true }).click()
  const panel = page.getByRole('region', { name: 'Plant contact introduction', exact: true })
  const predictions = panel.getByRole('group', { name: 'Plant target prediction' })
  await expect(panel.getByRole('img')).toHaveCount(0)
  if (mobile) await predictions.getByRole('button', { name: 'Ball 1', exact: true }).click()
  await page.getByRole('button', { name: `Choose finish ${selected.label}`, exact: true }).click()
  await page.getByRole('button', { name: 'Lock in your shot', exact: true }).click()
  await expect(panel.getByRole('status')).toContainText(mobile ? 'Ball 1 transfers motion' : 'Ball 2 is the plant’s potting target.', { timeout: 30000 })
  await expect(panel).toContainText(mobile ? `You chose reference plant finish ${reference.label}.` : 'You chose another stroke')
  for (const time of [e.first.time, e.transfer.time]) await expect(panel).toContainText(`${time.toFixed(3)} s`)
  for (const button of await predictions.getByRole('button').all()) await expect(button).toBeDisabled()
  const checkPath = async (id: string, expected: { x: number; y: number }[]) => {
    const path = (await panel.getByTestId(id).getAttribute('points'))!.split(' ').map(pair => pair.split(',').map(Number))
    expect(path.length).toBe(expected.length)
    path.forEach(([a, b], j) => { expect(a).toBeCloseTo(expected[j].x, 9); expect(b).toBeCloseTo(expected[j].y, 9) })
  }
  await checkPath('plant-cue-approach', x.simulation.cueApproachPath)
  await checkPath('plant-target-path', x.simulation.objectPath)
  await expect(page.locator('.perfect-celebration')).toHaveCount(0, { timeout: 10000 })
  for (const [i, event] of [e.first, e.transfer].entries()) {
    await panel.getByRole('group', { name: 'Inspect plant contacts' }).getByRole('button', { name: `Contact ${i + 1}`, exact: true }).click()
    for (const [j, id] of event.ballIds.entries()) {
      expect(Number(await panel.getByTestId(`plant-contact-ball-${id}`).getAttribute('cx'))).toBeCloseTo(event.positions[j].x, 9)
      expect(Number(await panel.getByTestId(`plant-contact-ball-${id}`).getAttribute('cy'))).toBeCloseTo(event.positions[j].y, 9)
    }
    const index = i === 0 ? 0 : e.firstIndex, d = normalize(event.incoming[index]), moving = event.positions[index]
    await checkPath('plant-incoming-arrow', [{ x: moving.x - d.x * .075, y: moving.y - d.y * .075 }, { x: moving.x - d.x * .035, y: moving.y - d.y * .035 }])
    await panel.getByRole('img', { name: `Contact ${i + 1}: recorded ball centers immediately before collision resolution`, exact: true }).scrollIntoViewIfNeeded()
    await page.locator('.shot-panel').screenshot({ path: `/tmp/plant-introduction-contact-${i + 1}-${mobile ? 'mobile' : 'desktop'}.png` })
  }
  await expect(panel.getByTestId('plant-contact-ball-0')).toHaveCount(0)
  await panel.getByRole('img', { name: 'Reference plant: cue approach to ball 1 and ball 2 path to the pocket', exact: true }).scrollIntoViewIfNeeded()
  await page.locator('.shot-panel').screenshot({ path: `/tmp/plant-introduction-route-${mobile ? 'mobile' : 'desktop'}.png` })
  await panel.getByRole('button', { name: 'Try the prediction again' }).click()
  await expect(panel.getByRole('img')).toHaveCount(0)
  await predictions.getByRole('button', { name: 'Ball 2', exact: true }).click()
  await panel.getByRole('button', { name: 'Check prediction' }).click()
  await expect(panel.getByRole('status')).toContainText('Correct: ball 2 is the plant’s potting target.')
  await expect(panel.getByRole('group', { name: 'Inspect plant contacts' }).getByRole('button', { name: 'Contact 1', exact: true })).toHaveAttribute('aria-pressed', 'true')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'Next level', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Start level 62', exact: true })).toBeVisible()
})
