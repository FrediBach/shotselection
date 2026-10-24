import { expect, test } from '@playwright/test'
import { DEFAULT_CHARACTER } from '../src/engine/characters'
import { prepareRound } from '../src/engine/preparation'
import { generateScenario } from '../src/engine/scenarios'
import { plantLineEvidence } from '../src/engine/plant-line'
import { startLevel } from './helpers'
for (const mobile of [true, false]) test(`inspect misaligned pair line on ${mobile ? 'mobile' : 'desktop'}`, async ({ page }) => {
  test.setTimeout(90000)
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1050 })
  await page.addInitScript(character => {
    localStorage.setItem('shot-selection-help-dismissed', 'true')
    localStorage.setItem('shot-selection-sound-enabled', 'false')
    localStorage.setItem('shot-selection-session', JSON.stringify({ character, scoringVersion: 2, courseVersion: 5, completedLessons: 61, level: 62, score: 0, rounds: 61, perfect: 0, seed: 0 }))
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function(type: string, ...args: unknown[]) { if (type === 'webgl2') return null; return original.call(this, type as '2d', ...args) } as typeof original
  }, DEFAULT_CHARACTER)
  const p = prepareRound(generateScenario(62, 62 * 919), { regenerate: false }), x = p.plantLine!
  const reference = p.balls.find(b => b.ballId === 1)!.options.find(o => o.id === x.referenceId)!
  const selected = mobile ? reference : p.balls.find(b => b.ballId === 3)!.options[0]
  const e = plantLineEvidence(p.scenario, reference.plan, x.simulation)!
  await page.goto('/'); await startLevel(page, 62)
  await expect(page.getByRole('button', { name: 'Plant target ball 2', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: mobile ? 'Select plant 1 to 2' : 'Select free ball 3', exact: true }).click()
  await page.getByRole('button', { name: 'Choose a finish', exact: true }).click()
  const panel = page.getByRole('region', { name: 'Plant pair-line comparison', exact: true })
  const predictions = panel.getByRole('group', { name: 'Pair-line prediction' })
  await expect(panel.getByRole('img')).toHaveCount(0)
  if (mobile) await predictions.getByRole('button', { name: 'Inside opening', exact: true }).click()
  await page.getByRole('button', { name: `Choose finish ${selected.label}`, exact: true }).click()
  await page.getByRole('button', { name: 'Lock in your shot', exact: true }).click()
  await expect(panel.getByRole('status')).toContainText(mobile ? 'The balls are close, but their line crosses outside' : 'The pair line crosses outside the opening.', { timeout: 30000 })
  await expect(panel).toContainText(mobile ? `You chose reference plant finish ${reference.label}.` : 'You chose another stroke')
  await expect(panel).toContainText(`${(e.outside * 1000).toFixed(1)} mm beyond`)
  await expect(panel).toContainText(`${(e.width * 1000).toFixed(1)} mm opening`)
  await expect(panel).toContainText('not a simulated trajectory')
  for (const time of [e.firstContact.time, e.transfer.time]) await expect(panel).toContainText(`${time.toFixed(3)} s`)
  for (const button of await predictions.getByRole('button').all()) await expect(button).toBeDisabled()
  const checkPath = async (id: string, expected: { x: number; y: number }[]) => {
    const path = (await panel.getByTestId(id).getAttribute('points'))!.split(' ').map(pair => pair.split(',').map(Number))
    expect(path.length).toBe(expected.length)
    path.forEach(([a, b], j) => { expect(a).toBeCloseTo(expected[j].x, 9); expect(b).toBeCloseTo(expected[j].y, 9) })
  }
  for (const id of ['pair-detail', 'pair-table']) {
    await checkPath(`${id}-line`, [e.first, e.target, e.hit]); await checkPath(`${id}-actual`, x.simulation.objectPath)
    await checkPath(`${id}-mouth`, e.pocket.mouth); await checkPath(`${id}-outside`, [e.edge, e.hit])
    const xy = (await panel.getByTestId(`${id}-hit`).getAttribute('transform'))!.slice(10, -1).split(' ').map(Number)
    expect(xy[0]).toBeCloseTo(e.hit.x, 9); expect(xy[1]).toBeCloseTo(e.hit.y, 9)
  }
  await expect(page.locator('.perfect-celebration')).toHaveCount(0, { timeout: 10000 })
  for (const [key, name] of [['detail', 'Pocket-mouth detail: geometric crossing outside the opening and actual ball 2 path'], ['table', 'Full table: initial pair line and simulated target-ball miss']] as const) {
    await panel.getByRole('img', { name, exact: true }).scrollIntoViewIfNeeded()
    await page.locator('.shot-panel').screenshot({ path: `/tmp/plant-line-${key}-${mobile ? 'mobile' : 'desktop'}.png` })
  }
  await panel.getByRole('button', { name: 'Try the prediction again' }).click()
  await expect(panel.getByRole('img')).toHaveCount(0)
  await predictions.getByRole('button', { name: 'Outside opening', exact: true }).click()
  await panel.getByRole('button', { name: 'Check prediction' }).click()
  await expect(panel.getByRole('status')).toContainText('Correct: the pair line crosses outside the opening.')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'Next level', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Start level 63', exact: true })).toBeVisible()
})
