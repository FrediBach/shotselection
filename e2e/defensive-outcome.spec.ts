import { expect, test } from '@playwright/test'
import { DEFAULT_CHARACTER } from '../src/engine/characters'
import { prepareRound } from '../src/engine/preparation'
import { generateScenario } from '../src/engine/scenarios'
import { analyzeRound } from '../src/engine/analysis'
import { defenseSummary, defenseWinner } from '../src/engine/defensive-outcome'

import { startLevel } from './helpers'
for (const mobile of [true, false]) test(`inspect defensive misses on ${mobile ? 'mobile' : 'desktop'}`, async ({ page }) => {
  test.setTimeout(90000)
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1050 })
  await page.addInitScript(character => {
    localStorage.setItem('shot-selection-help-dismissed', 'true')
    localStorage.setItem('shot-selection-sound-enabled', 'false')
    localStorage.setItem('shot-selection-session', JSON.stringify({ character, scoringVersion: 2, courseVersion: 5, completedLessons: 75, level: 76, score: 0, rounds: 75, perfect: 0, seed: 0 }))
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function(type: string, ...args: unknown[]) { if (type === 'webgl2') return null; return original.call(this, type as '2d', ...args) } as typeof original
  }, DEFAULT_CHARACTER)
  const p = prepareRound(generateScenario(76, 76 * 919), { regenerate: false }), ids = p.defenseOptionIds!
  const expected = analyzeRound(p, { ballId: 1, optionId: ids[0] }, { samples: 64 })
  const shots = ids.map(id => expected.candidates.find(s => s.plan.id === id)!), summaries = shots.map(s => defenseSummary(s.defenseTrials!, s.trialSuccesses!))
  await page.goto('/'); await startLevel(page, 76)
  await page.getByRole('button', { name: 'Select ball 1', exact: true }).click()
  await page.getByRole('button', { name: 'Choose a stroke', exact: true }).click()
  const panel = page.getByRole('region', { name: 'Defensive miss comparison', exact: true })
  await expect(panel.getByRole('table')).toHaveCount(0)
  await expect(panel.getByRole('img')).toHaveCount(0)
  if (mobile) await panel.getByRole('button', { name: 'Stroke B', exact: true }).click()
  await page.getByRole('button', { name: `Choose stroke ${mobile ? 'C' : 'A'}`, exact: true }).click()
  await page.getByRole('button', { name: 'Lock in your shot', exact: true }).click()
  await expect(panel.getByRole('status')).toContainText('Stroke C denies a direct route more often', { timeout: 30000 })
  await expect(page.locator('.perfect-celebration')).toHaveCount(0, { timeout: 10000 })
  expect(defenseWinner(summaries[0], summaries[1])).toBe('second')
  const ratio = (n: number, d: number) => `${n}/${d} (${(n / d * 100).toFixed(1)}%)`
  for (const [column, s] of summaries.entries()) {
    const values = [ratio(s.counts.pot, s.total), ratio(s.completed, s.total), `${s.misses}/${s.total}`, ratio(s.counts.open, s.misses), ratio(s.denied, s.misses), String(s.counts.screened), String(s.counts.limited), String(s.counts.unproven), String(s.counts.ineligible), ratio(s.twoWay, s.total)]
    for (const [row, value] of values.entries()) await expect(panel.getByTestId(`defense-row-${row}`).getByRole('cell').nth(column)).toHaveText(value)
  }
  for (const [index, shot] of shots.entries()) {
    await panel.getByRole('button', { name: `Inspect stroke ${index ? 'C' : 'B'}`, exact: true }).click()
    for (const kind of ['open', 'screened'] as const) {
      await panel.getByRole('button', { name: kind === 'open' ? 'Clear reply example' : 'Screened example', exact: true }).click()
      const e = shot.defenseExamples![kind]
      if (!e) { await expect(panel).toContainText(`No verified ${kind === 'open' ? 'clear-reply' : 'single-blocker screen'} example`); continue }
      await expect(panel.getByTestId('defense-example')).toContainText(`trial ${e.index + 1}`)
      await expect(panel.getByTestId('defense-example')).toContainText(`${e.reply.cutAngle.toFixed(1)}°`)
      const diagram = panel.getByRole('img', { name: 'Defensive leave and reply simulation' })
      await expect(diagram.locator('polyline')).toHaveCount(0)
      for (const [label, sim] of [['Missed opener', e.opening], [kind === 'open' ? 'Opponent pot' : 'Blocked reply', kind === 'open' ? e.reply.simulation : e.blockedReply!], ...(kind === 'screened' ? [['Remove blocker', e.reply.simulation] as const] : [])] as const) {
        await panel.getByRole('button', { name: label, exact: true }).click()
        expect(await diagram.locator('polyline').first().getAttribute('points')).toBe(sim.cuePath.map(p => `${p.x},${p.y}`).join(' '))
        expect(await diagram.locator('polyline').nth(1).getAttribute('points')).toBe(sim.objectPath.map(p => `${p.x},${p.y}`).join(' '))
      }
    }
  }
  for (const button of await panel.getByRole('group', { name: 'Defensive prediction' }).getByRole('button').all()) await expect(button).toBeDisabled()
  await panel.getByRole('table').scrollIntoViewIfNeeded()
  await page.locator('.shot-panel').screenshot({ path: `/tmp/defense-table-${mobile ? 'mobile' : 'desktop'}.png` })
  await panel.getByRole('img').scrollIntoViewIfNeeded()
  await page.locator('.shot-panel').screenshot({ path: `/tmp/defense-reply-${mobile ? 'mobile' : 'desktop'}.png` })
  await panel.getByRole('button', { name: 'Try the prediction again' }).click()
  await expect(panel.getByRole('table')).toHaveCount(0)
  await panel.getByRole('button', { name: 'Stroke C', exact: true }).click()
  await panel.getByRole('button', { name: 'Check prediction', exact: true }).click()
  await expect(panel.getByRole('status')).toContainText('Your prediction matches.')
  await expect(panel.getByRole('button', { name: 'Actual leftover balls', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(panel.getByRole('button', { name: 'Inspect stroke B', exact: true })).toHaveAttribute('aria-pressed', 'true')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'Next level', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Start level 77', exact: true })).toBeVisible()
})
