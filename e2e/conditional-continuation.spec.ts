import { expect, test } from '@playwright/test'
import { DEFAULT_CHARACTER } from '../src/engine/characters'
import { prepareRound } from '../src/engine/preparation'
import { generateScenario } from '../src/engine/scenarios'
import { analyzeRound } from '../src/engine/analysis'

import { startLevel } from './helpers'
for (const mobile of [true, false]) test(`compare conditional continuation on ${mobile ? 'mobile' : 'desktop'}`, async ({ page }) => {
  test.setTimeout(90000)
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1050 })
  await page.addInitScript(character => {
    localStorage.setItem('shot-selection-help-dismissed', 'true')
    localStorage.setItem('shot-selection-sound-enabled', 'false')
    localStorage.setItem('shot-selection-session', JSON.stringify({ character, scoringVersion: 2, courseVersion: 5, completedLessons: 71, level: 72, score: 0, rounds: 71, perfect: 0, seed: 0 }))
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function(type: string, ...args: unknown[]) { if (type === 'webgl2') return null; return original.call(this, type as '2d', ...args) } as typeof original
  }, DEFAULT_CHARACTER)
  const p = prepareRound(generateScenario(72, 72 * 919), { regenerate: false })
  const selected = p.balls[0].options[mobile ? 2 : 1]
  const result = analyzeRound(p, { ballId: selected.plan.ballId, optionId: selected.id }, { samples: 64, talents: DEFAULT_CHARACTER.talents })
  await page.goto('/'); await startLevel(page, 72)
  await page.getByRole('button', { name: 'Select ball 1', exact: true }).click()
  await page.getByRole('button', { name: 'Choose a stroke', exact: true }).click()
  const panel = page.getByRole('region', { name: 'Conditional continuation comparison', exact: true })
  const evidence = result.continuation!, labels = ['1% slower', 'Nominal', '1% faster']
  expect(evidence.sequence! - evidence.naive!).toBeGreaterThan(.02)
  await expect(panel.getByRole('table')).toHaveCount(0)
  for (const [i, probe] of p.continuation!.probes.entries()) {
    await panel.getByRole('button', { name: labels[i], exact: true }).click()
    await expect(panel.getByTestId('continuation-geometry')).toContainText(`Next cut: ${probe.cut!.toFixed(1)}°`)
    await expect(panel.getByTestId('continuation-geometry')).toContainText(`${probe.approach!.toFixed(2)} m`)
    const line = panel.getByRole('img').locator('polyline').first()
    expect(await line.getAttribute('points')).toBe(probe.first.cuePath.map(p => `${p.x},${p.y}`).join(' '))
  }
  if (mobile) await panel.getByRole('button', { name: 'Overestimates', exact: true }).click()
  await page.getByRole('button', { name: `Choose stroke ${selected.label}`, exact: true }).click()
  await page.getByRole('button', { name: 'Lock in your shot', exact: true }).click()
  await expect(panel.getByRole('status')).toContainText('underestimates', { timeout: 30000 })
  await expect(panel).toContainText(mobile ? 'You selected reference opener C.' : 'You selected another opener')
  await expect(panel.getByTestId('continuation-first')).toContainText(`${evidence.firstLegal}/${evidence.count}`)
  await expect(panel.getByTestId('continuation-nominal')).toContainText(`${evidence.nominalCompleted}/${evidence.count}`)
  await expect(panel.getByTestId('continuation-available')).toContainText(`${evidence.available}/${evidence.firstLegal}`)
  await expect(panel.getByTestId('continuation-conditional')).toContainText(`${evidence.completed}/${evidence.firstLegal}`)
  await expect(panel.getByTestId('continuation-naive')).toContainText(`${(evidence.naive! * 100).toFixed(1)}%`)
  await expect(panel.getByTestId('continuation-sequence')).toContainText(`${evidence.completed}/${evidence.count}`)
  await expect(panel).toContainText('a legal opener outside the zone can still continue')
  for (const button of await panel.getByRole('group', { name: 'Nominal-product prediction' }).getByRole('button').all()) await expect(button).toBeDisabled()
  await expect(page.locator('.perfect-celebration')).toHaveCount(0, { timeout: 10000 })
  await panel.getByRole('table').scrollIntoViewIfNeeded()
  await page.locator('.shot-panel').screenshot({ path: `/tmp/continuation-counts-${mobile ? 'mobile' : 'desktop'}.png` })
  await panel.getByRole('button', { name: 'Try the prediction again' }).click()
  await expect(panel.getByRole('table')).toHaveCount(0)
  await expect(panel.getByRole('button', { name: 'Nominal', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await panel.getByRole('img').scrollIntoViewIfNeeded()
  await page.locator('.shot-panel').screenshot({ path: `/tmp/continuation-geometry-${mobile ? 'mobile' : 'desktop'}.png` })
  await panel.getByRole('button', { name: 'Underestimates', exact: true }).click()
  await panel.getByRole('button', { name: 'Check prediction' }).click()
  await expect(panel.getByRole('status')).toContainText('Your prediction matches.')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'Next level', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Start level 73', exact: true })).toBeVisible()
})
