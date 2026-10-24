import { expect, test } from '@playwright/test'
import { DEFAULT_CHARACTER } from '../src/engine/characters'
import { prepareRound } from '../src/engine/preparation'
import { generateScenario } from '../src/engine/scenarios'
import { plantDeliveryEvidence } from '../src/engine/plant-delivery'
import { startLevel } from './helpers'
for (const mobile of [true, false]) test(`inspect angled plant delivery on ${mobile ? 'mobile' : 'desktop'}`, async ({ page }) => {
  test.setTimeout(90000)
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1050 })
  await page.addInitScript(character => {
    localStorage.setItem('shot-selection-help-dismissed', 'true')
    localStorage.setItem('shot-selection-sound-enabled', 'false')
    localStorage.setItem('shot-selection-session', JSON.stringify({ character, scoringVersion: 2, courseVersion: 5, completedLessons: 63, level: 64, score: 0, rounds: 63, perfect: 0, seed: 0 }))
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function(type: string, ...args: unknown[]) { if (type === 'webgl2') return null; return original.call(this, type as '2d', ...args) } as typeof original
  }, DEFAULT_CHARACTER)
  const p = prepareRound(generateScenario(64, 64 * 919), { regenerate: false }), x = p.plantDelivery!
  const reference = p.balls.find(b => b.ballId === 1)!.options.find(o => o.id === x.referenceId)!
  const selected = mobile ? reference : p.balls.find(b => b.ballId === 3)!.options[0]
  const e = plantDeliveryEvidence(p.scenario, reference.plan, x.simulation)!
  await page.goto('/'); await startLevel(page, 64)
  await expect(page.getByRole('button', { name: 'Plant target ball 2', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Select free ball 3', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: mobile ? 'Select plant 1 to 2' : 'Select free ball 3', exact: true }).click()
  await page.getByRole('button', { name: 'Choose a finish', exact: true }).click()
  const panel = page.getByRole('region', { name: 'Plant delivery comparison', exact: true })
  const predictions = panel.getByRole('group', { name: 'Plant delivery prediction' })
  await expect(panel.getByRole('img')).toHaveCount(0)
  if (mobile) await predictions.getByRole('button', { name: 'Pair line alone', exact: true }).click()
  await page.getByRole('button', { name: `Choose finish ${selected.label}`, exact: true }).click()
  await page.getByRole('button', { name: 'Lock in your shot', exact: true }).click()
  await expect(panel.getByRole('status')).toContainText('Check the first contact as well as the pair line.', { timeout: 30000 })
  await expect(panel).toContainText(mobile ? `You chose reference plant finish ${reference.label}.` : 'You chose another stroke')
  for (const time of [e.first.time, e.transfer.time]) await expect(panel).toContainText(`${time.toFixed(3)} s`)
  for (const button of await predictions.getByRole('button').all()) await expect(button).toBeDisabled()
  const checkPath = async (id: string, expected: { x: number; y: number }[]) => {
    const path = (await panel.getByTestId(id).getAttribute('points'))!.split(' ').map(pair => pair.split(',').map(Number))
    expect(path.length).toBe(expected.length)
    path.forEach(([a, b], j) => { expect(a).toBeCloseTo(expected[j].x, 9); expect(b).toBeCloseTo(expected[j].y, 9) })
  }
  await checkPath('delivery-cue-path', x.simulation.cueApproachPath)
  await checkPath('delivery-target-path', x.simulation.objectPath)
  await expect(page.locator('.perfect-celebration')).toHaveCount(0, { timeout: 10000 })
  const cue = e.first.positions[0], first = e.first.positions[1]
  await checkPath('delivery-incoming', [{ x: cue.x - e.incoming.x * .13, y: cue.y - e.incoming.y * .13 }, { x: cue.x - e.incoming.x * .035, y: cue.y - e.incoming.y * .035 }])
  await checkPath('delivery-pair-arrow', [first, { x: first.x + e.geometry.direction.x * .17, y: first.y + e.geometry.direction.y * .17 }])
  await checkPath('delivery-contact-normal', [cue, first])
  await checkPath('delivery-pair-line', [e.geometry.first, e.geometry.target, e.geometry.hit])
  await expect(panel).toContainText(`${e.deliveryAngle.toFixed(1)}°`)
  for (const [id, position] of [[0, cue], [1, first], [2, e.geometry.target]] as const) {
    expect(Number(await panel.getByTestId(`delivery-ball-${id}`).getAttribute('cx'))).toBeCloseTo(position.x, 9)
    expect(Number(await panel.getByTestId(`delivery-ball-${id}`).getAttribute('cy'))).toBeCloseTo(position.y, 9)
  }
  for (const [key, name] of [['detail', 'First-contact detail: incoming cue direction and initial pair direction'], ['table', 'Full table: cue delivery, initial pair line and actual target pot']] as const) {
    await panel.getByRole('img', { name, exact: true }).scrollIntoViewIfNeeded()
    await page.locator('.shot-panel').screenshot({ path: `/tmp/plant-delivery-${key}-${mobile ? 'mobile' : 'desktop'}.png` })
  }
  await panel.getByRole('button', { name: 'Try the prediction again' }).click()
  await expect(panel.getByRole('img')).toHaveCount(0)
  await predictions.getByRole('button', { name: 'Pair line and first contact', exact: true }).click()
  await panel.getByRole('button', { name: 'Check prediction' }).click()
  await expect(panel.getByRole('status')).toContainText('Correct: check the first contact as well as the pair line.')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'Next level', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Start level 65', exact: true })).toBeVisible()
})
