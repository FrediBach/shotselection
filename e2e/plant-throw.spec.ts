import { expect, test } from '@playwright/test'
import { DEFAULT_CHARACTER } from '../src/engine/characters'
import { prepareRound } from '../src/engine/preparation'
import { generateScenario } from '../src/engine/scenarios'
import { plantThrowEvidence } from '../src/engine/plant-throw'
import { startLevel } from './helpers'
for (const mobile of [true, false]) test(`inspect collision throw on ${mobile ? 'mobile' : 'desktop'}`, async ({ page }) => {
  test.setTimeout(90000)
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1050 })
  await page.addInitScript(character => {
    localStorage.setItem('shot-selection-help-dismissed', 'true')
    localStorage.setItem('shot-selection-sound-enabled', 'false')
    localStorage.setItem('shot-selection-session', JSON.stringify({ character, scoringVersion: 2, courseVersion: 5, completedLessons: 65, level: 66, score: 0, rounds: 65, perfect: 0, seed: 0 }))
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function(type: string, ...args: unknown[]) { if (type === 'webgl2') return null; return original.call(this, type as '2d', ...args) } as typeof original
  }, DEFAULT_CHARACTER)
  const p = prepareRound(generateScenario(66, 66 * 919), { regenerate: false }), x = p.plantThrow!
  const reference = p.balls.find(b => b.ballId === 1)!.options.find(o => o.id === x.referenceId)!
  const selected = mobile ? reference : p.balls.find(b => b.ballId === 3)!.options[0]
  const e = plantThrowEvidence(p.scenario, reference.plan, x)!
  await page.goto('/'); await startLevel(page, 66)
  await expect(page.getByRole('button', { name: 'Plant target ball 2', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Select free ball 3', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: mobile ? 'Select plant 1 to 2' : 'Select free ball 3', exact: true }).click()
  await page.getByRole('button', { name: 'Choose a finish', exact: true }).click()
  const panel = page.getByRole('region', { name: 'Plant collision-throw comparison', exact: true })
  const predictions = panel.getByRole('group', { name: 'Collision-throw prediction' })
  await expect(panel.getByRole('img')).toHaveCount(0)
  if (mobile) await predictions.getByRole('button', { name: 'Follows contact-center line', exact: true }).click()
  await page.getByRole('button', { name: `Choose finish ${selected.label}`, exact: true }).click()
  await page.getByRole('button', { name: 'Lock in your shot', exact: true }).click()
  await expect(panel.getByRole('status')).toContainText('Collision friction deflects ball 2.', { timeout: 30000 })
  await expect(panel).toContainText(mobile ? `You chose reference plant finish ${reference.label}.` : 'You chose another stroke')
  for (const time of [e.first.time, e.transfer.time]) await expect(panel).toContainText(`${time.toFixed(3)} s`)
  for (const button of await predictions.getByRole('button').all()) await expect(button).toBeDisabled()
  const checkPath = async (id: string, expected: { x: number; y: number }[]) => {
    const path = (await panel.getByTestId(id).getAttribute('points'))!.split(' ').map(pair => pair.split(',').map(Number))
    expect(path.length).toBe(expected.length)
    path.forEach(([a, b], j) => { expect(a).toBeCloseTo(expected[j].x, 9); expect(b).toBeCloseTo(expected[j].y, 9) })
  }
  const target = e.transfer.positions[1], first = e.transfer.positions[0]
  const ray = (d: { x: number; y: number }) => [target, { x: target.x + d.x * .16, y: target.y + d.y * .16 }]
  await checkPath('throw-contact-centers', [first, target])
  await checkPath('throw-pair-direction', ray(e.geometry.direction))
  await checkPath('throw-normal-direction', ray(e.normal))
  await checkPath('throw-outgoing-direction', ray(e.outgoing))
  await checkPath('throw-control-path', x.frictionless.objectPath)
  await checkPath('throw-actual-path', x.actual.objectPath)
  await checkPath('throw-initial-line', [e.geometry.first, e.geometry.target, e.geometry.hit])
  await checkPath('throw-mouth', e.geometry.pocket.mouth)
  await checkPath('throw-mouth-shift', [e.controlHit, e.actualHit])
  for (const angle of [e.oblique, e.deliveryAngle, e.throwAngle]) await expect(panel).toContainText(`${angle.toFixed(2)}°`)
  await expect(panel).toContainText(`${(e.mouthShift * 1000).toFixed(1)} mm`)
  await expect(panel).toContainText('Both references pot ball 2')
  await expect(panel).toContainText('only between balls 1 and 2')
  for (const [id, position] of [[1, first], [2, target]] as const) {
    expect(Number(await panel.getByTestId(`throw-contact-ball-${id}`).getAttribute('cx'))).toBeCloseTo(position.x, 9)
    expect(Number(await panel.getByTestId(`throw-contact-ball-${id}`).getAttribute('cy'))).toBeCloseTo(position.y, 9)
  }
  await expect(page.locator('.perfect-celebration')).toHaveCount(0, { timeout: 10000 })
  await panel.getByRole('img', { name: 'Transfer snapshot: initial pair, contact normal and actual outgoing direction', exact: true }).scrollIntoViewIfNeeded()
  await page.locator('.shot-panel').screenshot({ path: `/tmp/plant-throw-contact-${mobile ? 'mobile' : 'desktop'}.png` })
  for (const mode of ['Pocket detail', 'Full table']) {
    await panel.getByRole('group', { name: 'Inspect throw paths' }).getByRole('button', { name: mode, exact: true }).click()
    const svg = panel.getByRole('img', { name: 'Target paths with ordinary and friction-free plant transfer', exact: true })
    await svg.scrollIntoViewIfNeeded()
    if (mode === 'Full table') await expect(svg).toHaveAttribute('viewBox', '-.08 -.08 2.70 1.43')
    await page.locator('.shot-panel').screenshot({ path: `/tmp/plant-throw-${mode === 'Full table' ? 'table' : 'detail'}-${mobile ? 'mobile' : 'desktop'}.png` })
  }
  await panel.getByRole('button', { name: 'Try the prediction again' }).click()
  await expect(panel.getByRole('img')).toHaveCount(0)
  await predictions.getByRole('button', { name: 'Friction can deflect it', exact: true }).click()
  await panel.getByRole('button', { name: 'Check prediction' }).click()
  await expect(panel.getByRole('status')).toContainText('Correct: collision friction deflects ball 2.')
  await expect(panel.getByRole('group', { name: 'Inspect throw paths' }).getByRole('button', { name: 'Pocket detail', exact: true })).toHaveAttribute('aria-pressed', 'true')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'Next level', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Start level 67', exact: true })).toBeVisible()
})
