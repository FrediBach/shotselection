import { expect, test } from '@playwright/test'
import { DEFAULT_CHARACTER } from '../src/engine/characters'
import { prepareRound } from '../src/engine/preparation'
import { generateScenario } from '../src/engine/scenarios'
import { kickMiddleEvidence } from '../src/engine/kick-middle'
import { startLevel } from './helpers'
for (const mobile of [true, false]) test(`inspect middle kick leg on ${mobile ? 'mobile' : 'desktop'}`, async ({ page }) => {
  test.setTimeout(90000)
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1050 })
  await page.addInitScript(character => {
    localStorage.setItem('shot-selection-help-dismissed', 'true')
    localStorage.setItem('shot-selection-sound-enabled', 'false')
    localStorage.setItem('shot-selection-session', JSON.stringify({ character, scoringVersion: 2, courseVersion: 5, completedLessons: 57, level: 58, score: 0, rounds: 57, perfect: 0, seed: 0 }))
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function(type: string, ...args: unknown[]) { if (type === 'webgl2') return null; return original.call(this, type as '2d', ...args) } as typeof original
  }, DEFAULT_CHARACTER)
  const p = prepareRound(generateScenario(58, 58 * 919), { regenerate: false }), x = p.kickMiddle!
  const reference = p.balls[0].options.find(o => o.id === x.referenceId)!
  const selected = mobile ? reference : p.balls[0].options.find(o => o.id !== x.referenceId)!
  const e = kickMiddleEvidence(p.scenario, reference.plan, x)!, clear = p.scenario.seed % 2 ? 1 : 2, blocked = 3 - clear
  await page.goto('/'); await startLevel(page, 58)
  await page.getByRole('button', { name: 'Choose a stroke', exact: true }).click()
  const panel = page.getByRole('region', { name: 'Middle-leg comparison', exact: true })
  const predictions = panel.getByRole('group', { name: 'Middle-leg prediction' })
  await expect(panel.getByRole('img')).toHaveCount(2)
  await expect(panel.getByTestId(`middle-route-${blocked}-leg-3`)).toHaveCount(1)
  await expect(panel.getByTestId('middle-contact-center')).toHaveCount(0)
  if (mobile) await predictions.getByRole('button', { name: `Route ${blocked}`, exact: true }).click()
  await page.getByRole('button', { name: `Choose finish ${selected.label}`, exact: true }).click()
  await page.getByRole('button', { name: 'Lock in your shot', exact: true }).click()
  await expect(panel.getByRole('status')).toContainText(mobile ? `Route ${blocked} hits ball 10 before R2.` : `Route ${clear} clears the middle leg.`, { timeout: 30000 })
  await expect(panel).toContainText(mobile ? `You chose reference finish ${reference.label}.` : 'You chose another finish')
  await expect(panel).toContainText(`${(e.clearGaps[1] * 1000).toFixed(1)} mm`)
  await expect(panel).toContainText(`${(e.gaps[0] * 1000).toFixed(1)} and ${(e.gaps[2] * 1000).toFixed(1)} mm`)
  await expect(panel).toContainText(`${e.contact.time.toFixed(2)} s`)
  for (const button of await predictions.getByRole('button').all()) await expect(button).toBeDisabled()
  const checkPath = async (id: string, expected: { x: number; y: number }[]) => {
    const actual = (await panel.getByTestId(id).getAttribute('points'))!.split(' ').map(pair => pair.split(',').map(Number))
    expect(actual.length).toBe(expected.length)
    actual.forEach(([a, b], i) => { expect(a).toBeCloseTo(expected[i].x, 9); expect(b).toBeCloseTo(expected[i].y, 9) })
  }
  for (const [n, legs] of [[clear, e.reference.legs], [blocked, e.blockedLegs]] as const)
    for (const [i, leg] of legs.entries()) await checkPath(`middle-route-${n}-leg-${i + 1}`, leg)
  await expect(panel.getByTestId(`middle-route-${blocked}-leg-3`)).toHaveCount(0)
  expect(Number(await panel.getByTestId('middle-contact-center').getAttribute('cx'))).toBeCloseTo(e.contact.position.x, 9)
  expect(Number(await panel.getByTestId('middle-contact-center').getAttribute('cy'))).toBeCloseTo(e.contact.position.y, 9)
  await expect(page.locator('.perfect-celebration')).toHaveCount(0, { timeout: 10000 })
  await panel.getByRole('img', { name: `Route ${blocked}: actual outcome`, exact: true }).scrollIntoViewIfNeeded()
  await page.locator('.shot-panel').screenshot({ path: `/tmp/kick-middle-blocked-${mobile ? 'mobile' : 'desktop'}.png` })
  await panel.getByRole('img', { name: 'Enlarged actual collision between rebounds', exact: true }).scrollIntoViewIfNeeded()
  await page.locator('.shot-panel').screenshot({ path: `/tmp/kick-middle-contact-${mobile ? 'mobile' : 'desktop'}.png` })
  await panel.getByRole('button', { name: `Show route ${blocked} without ball 10`, exact: true }).click()
  await expect(panel.getByTestId('middle-removal-ball-10')).toHaveCount(0)
  for (let i = 0; i < 10; i++) await expect(panel.getByTestId(`middle-removal-ball-${i}`)).toHaveCount(1)
  for (const [i, leg] of e.intended.legs.entries()) await checkPath(`middle-removal-leg-${i + 1}`, leg)
  await checkPath('middle-removal-pot', x.intended.objectPath)
  await panel.getByRole('img', { name: 'Removal test: same stroke completes both rebounds and pots ball 1', exact: true }).scrollIntoViewIfNeeded()
  await page.locator('.shot-panel').screenshot({ path: `/tmp/kick-middle-removal-${mobile ? 'mobile' : 'desktop'}.png` })
  await panel.getByRole('button', { name: 'Try the prediction again' }).click()
  await expect(panel.getByTestId('middle-removal-pot')).toHaveCount(0)
  await predictions.getByRole('button', { name: `Route ${clear}`, exact: true }).click()
  await panel.getByRole('button', { name: 'Check prediction' }).click()
  await expect(panel.getByRole('status')).toContainText(`Correct: route ${clear} clears the middle leg.`)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'Next level', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Start level 59', exact: true })).toBeVisible()
})
