import { expect, test } from '@playwright/test'
import { DEFAULT_CHARACTER } from '../src/engine/characters'
import { prepareRound } from '../src/engine/preparation'
import { generateScenario } from '../src/engine/scenarios'
import { plantGapEvidence } from '../src/engine/plant-gap'
import { startLevel } from './helpers'
for (const mobile of [true, false]) test(`inspect first-ball gap travel on ${mobile ? 'mobile' : 'desktop'}`, async ({ page }) => {
  test.setTimeout(90000)
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1050 })
  await page.addInitScript(character => {
    localStorage.setItem('shot-selection-help-dismissed', 'true')
    localStorage.setItem('shot-selection-sound-enabled', 'false')
    localStorage.setItem('shot-selection-session', JSON.stringify({ character, scoringVersion: 2, courseVersion: 5, completedLessons: 66, level: 67, score: 0, rounds: 66, perfect: 0, seed: 0 }))
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function(type: string, ...args: unknown[]) { if (type === 'webgl2') return null; return original.call(this, type as '2d', ...args) } as typeof original
  }, DEFAULT_CHARACTER)
  const p = prepareRound(generateScenario(67, 67 * 919), { regenerate: false }), x = p.plantGap!
  const reference = p.balls.find(b => b.ballId === 1)!.options.find(o => o.id === x.referenceId)!
  const selected = mobile ? reference : p.balls.find(b => b.ballId === 3)!.options[0]
  const e = plantGapEvidence(p.scenario, reference.plan, x.simulation)!
  await page.goto('/'); await startLevel(page, 67)
  await expect(page.getByRole('button', { name: 'Plant target ball 2', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Select free ball 3', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: mobile ? 'Select plant 1 to 2' : 'Select free ball 3', exact: true }).click()
  await page.getByRole('button', { name: 'Choose a finish', exact: true }).click()
  const panel = page.getByRole('region', { name: 'Plant transfer-gap comparison', exact: true })
  const predictions = panel.getByRole('group', { name: 'Transfer-gap prediction' })
  await expect(panel.getByRole('img')).toHaveCount(0)
  if (mobile) await predictions.getByRole('button', { name: 'Only ball 2’s potting run', exact: true }).click()
  await page.getByRole('button', { name: `Choose finish ${selected.label}`, exact: true }).click()
  await page.getByRole('button', { name: 'Lock in your shot', exact: true }).click()
  await expect(panel.getByRole('status')).toContainText('Ball 1 must first cross the gap and contact ball 2.', { timeout: 30000 })
  await expect(panel).toContainText(mobile ? `You chose reference plant finish ${reference.label}.` : 'You chose another stroke')
  for (const time of [e.first.time, e.transfer.time]) await expect(panel).toContainText(`${time.toFixed(3)} s`)
  for (const button of await predictions.getByRole('button').all()) await expect(button).toBeDisabled()
  const checkPath = async (id: string, expected: { x: number; y: number }[]) => {
    const path = (await panel.getByTestId(id).getAttribute('points'))!.split(' ').map(pair => pair.split(',').map(Number))
    expect(path.length).toBe(expected.length)
    path.forEach(([a, b], j) => { expect(a).toBeCloseTo(expected[j].x, 9); expect(b).toBeCloseTo(expected[j].y, 9) })
  }
  await checkPath('gap-cue-path', x.simulation.cueApproachPath)
  await checkPath('gap-transfer-path', e.path)
  await checkPath('gap-target-path', x.simulation.objectPath)
  await expect(panel).toContainText(`${(e.spacing * 100).toFixed(1)} cm apart`)
  await expect(panel).toContainText(`${(e.gap * 100).toFixed(2)} cm`)
  await expect(panel).toContainText(`${(e.travel * 100).toFixed(2)} cm over ${(e.duration * 1000).toFixed(1)} ms`)
  await expect(panel.getByTestId('gap-detail-path')).toHaveCount(0)
  expect(Number(await panel.getByTestId('gap-contact-ball-1').getAttribute('cy'))).toBeCloseTo(e.first.positions[1].y, 9)
  await expect(page.locator('.perfect-celebration')).toHaveCount(0, { timeout: 10000 })
  for (const transferred of [false, true]) {
    await panel.getByRole('group', { name: 'Inspect gap travel' }).getByRole('button', { name: transferred ? '1 → 2' : 'Cue → 1', exact: true }).click()
    const first = transferred ? e.transfer.positions[0] : e.first.positions[1]
    for (const [id, position] of [[1, first], [2, e.targetBall.position]] as const) {
      expect(Number(await panel.getByTestId(`gap-contact-ball-${id}`).getAttribute('cx'))).toBeCloseTo(position.x, 9)
      expect(Number(await panel.getByTestId(`gap-contact-ball-${id}`).getAttribute('cy'))).toBeCloseTo(position.y, 9)
    }
    if (transferred) await checkPath('gap-detail-path', e.path)
    await panel.getByRole('img', { name: 'Ball 1 gap travel between recorded contact positions', exact: true }).scrollIntoViewIfNeeded()
    await page.locator('.shot-panel').screenshot({ path: `/tmp/plant-gap-${transferred ? 'transfer' : 'start'}-${mobile ? 'mobile' : 'desktop'}.png` })
  }
  await panel.getByRole('img', { name: 'Full plant: cue approach, ball 1 transfer travel and ball 2 potting path', exact: true }).scrollIntoViewIfNeeded()
  await page.locator('.shot-panel').screenshot({ path: `/tmp/plant-gap-table-${mobile ? 'mobile' : 'desktop'}.png` })
  await panel.getByRole('button', { name: 'Try the prediction again' }).click()
  await expect(panel.getByRole('img')).toHaveCount(0)
  await predictions.getByRole('button', { name: 'Ball 1’s gap and ball 2’s run', exact: true }).click()
  await panel.getByRole('button', { name: 'Check prediction' }).click()
  await expect(panel.getByRole('status')).toContainText('Correct: ball 1 must first cross the gap and contact ball 2.')
  await expect(panel.getByRole('group', { name: 'Inspect gap travel' }).getByRole('button', { name: 'Cue → 1', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(panel.getByTestId('gap-detail-path')).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'Next level', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Start level 68', exact: true })).toBeVisible()
})
