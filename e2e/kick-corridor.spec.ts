import { expect, test } from '@playwright/test'
import { DEFAULT_CHARACTER } from '../src/engine/characters'
import { prepareRound } from '../src/engine/preparation'
import { generateScenario } from '../src/engine/scenarios'
import { kickCorridorEvidence } from '../src/engine/kick-corridor'
import { startLevel } from './helpers'

for (const mobile of [true, false]) test(`inspect both kick legs on ${mobile ? 'mobile' : 'desktop'}`, async ({ page }) => {
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1050 })
  await page.addInitScript(character => {
    localStorage.setItem('shot-selection-help-dismissed', 'true')
    localStorage.setItem('shot-selection-sound-enabled', 'false')
    localStorage.setItem('shot-selection-session', JSON.stringify({ character, scoringVersion: 2, courseVersion: 5, completedLessons: 54, level: 55, score: 0, rounds: 54, perfect: 0, seed: 0 }))
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function(type: string, ...args: unknown[]) { if (type === 'webgl2') return null; return original.call(this, type as '2d', ...args) } as typeof original
  }, DEFAULT_CHARACTER)
  const p = prepareRound(generateScenario(55, 55 * 919), { regenerate: false }), x = p.kickCorridor!
  const reference = p.balls[0].options.find(o => o.id === x.referenceId)!
  const selected = mobile ? reference : p.balls[0].options.find(o => o.id !== x.referenceId)!
  const e = kickCorridorEvidence(p.scenario, reference.plan, x)!
  const clear = p.scenario.seed % 2 ? 1 : 2, blocked = 3 - clear
  await page.goto('/'); await startLevel(page, 55)
  await page.getByRole('button', { name: 'Choose a stroke', exact: true }).click()
  const panel = page.getByRole('region', { name: 'Kick corridor comparison', exact: true })
  const predictions = panel.getByRole('group', { name: 'Kick corridor prediction' })
  await expect(panel.getByRole('img')).toHaveCount(2)
  await expect(panel.getByTestId('kick-corridor-contact')).toHaveCount(0)
  await expect(panel).toContainText('ball 3 is overlaid at its actual position')
  await panel.getByRole('img', { name: `Route ${blocked}: two-leg clearance preview` }).scrollIntoViewIfNeeded()
  await page.locator('.shot-panel').screenshot({ path: `/tmp/kick-corridor-preview-${mobile ? 'mobile' : 'desktop'}.png` })
  if (mobile) await predictions.getByRole('button', { name: `Route ${blocked}`, exact: true }).click()
  await page.getByRole('button', { name: `Choose finish ${selected.label}`, exact: true }).click()
  await page.getByRole('button', { name: 'Lock in your shot', exact: true }).click()
  await expect(panel.getByRole('status')).toContainText(mobile ? `Route ${blocked} reaches the rail, but ball 3 blocks the outgoing leg.` : `Route ${clear} clears both legs.`, { timeout: 30000 })
  await expect(panel).toContainText(mobile ? `You chose reference finish ${reference.label}.` : 'You chose another finish')
  for (const gap of [e.clearIncoming, e.clearOutgoing, e.incomingClearance]) await expect(panel).toContainText(`${(gap * 1000).toFixed(1)} mm`)
  await expect(panel).toContainText(`first at ${e.contact.time.toFixed(2)} s`)
  expect(Number(await panel.getByTestId('kick-corridor-contact').getAttribute('cx'))).toBeCloseTo(e.contact.position.x, 9)
  expect(Number(await panel.getByTestId('kick-corridor-contact').getAttribute('cy'))).toBeCloseTo(e.contact.position.y, 9)
  for (const button of await predictions.getByRole('button').all()) await expect(button).toBeDisabled()
  await expect(page.locator('.perfect-celebration')).toHaveCount(0, { timeout: 10000 })
  for (const [n, incoming, outgoing] of [[clear, e.referenceOpen.incoming, e.referenceOpen.outgoing], [blocked, e.blockedIncoming, e.blockedOutgoing]] as const) {
    for (const [leg, expected] of [['incoming', incoming], ['outgoing', outgoing]] as const) {
      const path = (await panel.getByTestId(`kick-corridor-route-${n}-${leg}`).getAttribute('points'))!.split(' ').map(pair => pair.split(',').map(Number))
      expect(path.length).toBe(expected.length)
      path.forEach(([a, b], i) => { expect(a).toBeCloseTo(expected[i].x, 9); expect(b).toBeCloseTo(expected[i].y, 9) })
    }
    await panel.getByRole('img', { name: `Route ${n}: verified approach outcome` }).scrollIntoViewIfNeeded()
    await page.locator('.shot-panel').screenshot({ path: `/tmp/kick-corridor-route-${n}-${mobile ? 'mobile' : 'desktop'}.png` })
  }
  await panel.getByRole('img', { name: 'Blocked outgoing leg: actual cue-ball contact with ball 3' }).scrollIntoViewIfNeeded()
  await page.locator('.shot-panel').screenshot({ path: `/tmp/kick-corridor-contact-${mobile ? 'mobile' : 'desktop'}.png` })
  await panel.getByRole('button', { name: `Show route ${blocked} without ball 3`, exact: true }).click()
  await expect(panel.getByRole('img')).toHaveCount(4)
  await expect(panel.getByTestId('kick-corridor-removal-ball-3')).toHaveCount(0)
  for (const id of [0, 1, 2]) await expect(panel.getByTestId(`kick-corridor-removal-ball-${id}`)).toHaveCount(1)
  await expect(panel.getByTestId('kick-corridor-removal-pot')).toHaveCount(1)
  await panel.getByRole('img', { name: 'Removal test: unchanged stroke now reaches and pots ball 1' }).scrollIntoViewIfNeeded()
  await page.locator('.shot-panel').screenshot({ path: `/tmp/kick-corridor-removal-${mobile ? 'mobile' : 'desktop'}.png` })
  await panel.getByRole('button', { name: 'Try the prediction again' }).click()
  await expect(panel.getByRole('img')).toHaveCount(2)
  await predictions.getByRole('button', { name: `Route ${clear}`, exact: true }).click()
  await panel.getByRole('button', { name: 'Check prediction' }).click()
  await expect(panel.getByRole('status')).toContainText(`Correct: route ${clear} clears both legs.`)
  await expect(panel.getByRole('img')).toHaveCount(3)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'Next level', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Start level 56', exact: true })).toBeVisible()
})
